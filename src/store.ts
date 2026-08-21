import { create } from "zustand";
import {
  DEFAULT_SETTINGS,
  EMPTY_APP_STATE,
  MOOD_LABEL,
  type AtomicTask,
  type AppState,
  type ChatMessage,
  type Goal,
  type GoalType,
  type MoodState,
  type Phase,
  type TaskStatus,
} from "./types.ts";
import {
  addMessage as dbAddMessage,
  exportAppJson,
  loadAppState,
  persistAppState,
  putGoal,
  saveSettings,
  setActiveGoalId,
  setApiKey as dbSetApiKey,
} from "./db.ts";
import { applyProgress, EMPTY_TODAY_TASKS, pickTodayTasks, upsertTodaySnapshot } from "./lib/progress.ts";
import { clamp, newId, nowIso, todayDate } from "./lib/ids.ts";
import { GrokError, callGrok } from "./lib/grok.ts";
import {
  type GuidedOptionJson,
  type PlanJson,
  type PlanPhaseJson,
  type ProbeQuestionJson,
  type ReplanJson,
  PromptParseError,
  guidedMessages,
  moodMessages,
  parseGuidedResponse,
  parseMoodResponse,
  parsePlanResponse,
  parseProbeResponse,
  parseReplanResponse,
  planMessages,
  probeMessages,
  replanMessages,
} from "./lib/prompts.ts";
import {
  detectIntent,
  extractExtraTitle,
  extractNewTaskTitle,
  looksLikeMoodSignal,
} from "./lib/intents.ts";

export interface CreateGoalInput {
  type: GoalType;
  title: string;
  description: string;
  mood: MoodState;
  targetDate?: string;
}

export interface PendingMoodAsk {
  mood: MoodState;
  message: string;
}

export type MoodAsk = PendingMoodAsk;

interface Store extends AppState {
  hydrated: boolean;
  busy: boolean;
  error: string | null;
  showKeySettings: boolean;
  creatingGoal: boolean;
  pendingGuided: GuidedOptionJson[] | null;
  pendingMoodAsk: PendingMoodAsk | null;
  pendingProbe: ProbeQuestionJson[] | null;
  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  setShowKeySettings: (show: boolean) => void;
  createGoal: (input: CreateGoalInput) => Promise<void>;
  setActiveGoal: (id: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  skipTask: (taskId: string) => Promise<void>;
  addChat: (input: Omit<ChatMessage, "id" | "timestamp">) => Promise<ChatMessage>;
  addTask: (draft: {
    title: string;
    description?: string;
    estimatedMinutes?: number;
    weight?: number;
    status?: TaskStatus;
  }) => Promise<AtomicTask | null>;
  applyPlanJson: (plan: PlanJson, keepFinished?: boolean) => Promise<Goal | undefined>;
  applyReplan: (replan: ReplanJson) => Promise<Goal | undefined>;
  setMood: (mood: MoodState) => Promise<void>;
  confirmMoodChange: (accept: boolean) => Promise<void>;
  sendChat: (text: string) => Promise<void>;
  chooseGuided: (optionId: string) => Promise<void>;
  answerProbe: (answers: Record<string, string>) => Promise<void>;
  retryPlan: () => Promise<void>;
  startNewGoal: () => void;
  cancelCreate: () => void;
  dismissError: () => void;
  exportJson: () => Promise<string>;
}

function makeMsg(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: newId("msg"),
    role,
    content,
    timestamp: nowIso(),
    ...extra,
  };
}

function replaceGoal(goals: Goal[], next: Goal): Goal[] {
  const exists = goals.some((goal) => goal.id === next.id);
  if (!exists) return [...goals, next];
  return goals.map((goal) => (goal.id === next.id ? next : goal));
}

/** progress.ts does not export this — keep weight math in applyProgress. */
function recalcGoal(goal: Goal): Goal {
  return applyProgress(goal);
}

/** Daily snapshot helper; progress.ts only exports upsertTodaySnapshot. */
function snapshotHistory(goal: Goal, notes?: string): Goal {
  return upsertTodaySnapshot(goal, todayDate(), notes);
}

function mapTask(
  goal: Goal,
  taskId: string,
  update: (task: AtomicTask) => AtomicTask,
): Goal {
  const phases = goal.phases.map((phase) => ({
    ...phase,
    tasks: phase.tasks.map((task) => (task.id === taskId ? update(task) : task)),
  }));
  return { ...goal, phases };
}

function setTaskStatus(goal: Goal, taskId: string, status: TaskStatus): Goal {
  const next = mapTask(goal, taskId, (task) => ({
    ...task,
    status,
    completedAt: status === "done" ? task.completedAt ?? nowIso() : undefined,
  }));
  return snapshotHistory(recalcGoal(next));
}

function addTaskToGoal(goal: Goal, task: AtomicTask): Goal {
  const ordered = [...goal.phases].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) {
    const phase: Phase = {
      id: newId("phase"),
      title: "眼前这一步",
      order: 0,
      tasks: [task],
    };
    return snapshotHistory(recalcGoal({ ...goal, phases: [phase] }));
  }
  const target =
    ordered.find((phase) => !phase.isPlaceholder && phase.tasks.some((item) => item.status === "pending")) ??
    ordered.find((phase) => !phase.isPlaceholder) ??
    ordered[0];
  const phases = goal.phases.map((phase) =>
    phase.id === target.id ? { ...phase, tasks: [...phase.tasks, task] } : phase,
  );
  return snapshotHistory(recalcGoal({ ...goal, phases }));
}

function findMatchingPending(goal: Goal, title: string): AtomicTask | undefined {
  const needle = title.trim().toLowerCase();
  if (!needle) return undefined;
  const pending = goal.phases.flatMap((phase) => phase.tasks).filter((task) => task.status === "pending");
  return (
    pending.find((task) => task.title.toLowerCase() === needle) ??
    pending.find(
      (task) => task.title.toLowerCase().includes(needle) || needle.includes(task.title.toLowerCase()),
    )
  );
}

function draftTask(
  draft: { title: string; description?: string; estimatedMinutes: number; weight: number },
  status: TaskStatus = "pending",
): AtomicTask {
  return {
    id: newId("task"),
    title: draft.title,
    description: draft.description,
    estimatedMinutes: clamp(Math.round(draft.estimatedMinutes), 10, 20),
    weight: clamp(Math.round(draft.weight), 1, 10),
    status,
    completedAt: status === "done" ? nowIso() : undefined,
  };
}

function draftsToPhases(phases: PlanPhaseJson[]): Phase[] {
  return phases.map((phase, index) => ({
    id: newId("phase"),
    title: phase.title,
    description: phase.description,
    order: index,
    isPlaceholder: !!phase.isPlaceholder,
    tasks: phase.tasks.map((task) => draftTask(task)),
  }));
}

function applyPlan(goal: Goal, phases: PlanPhaseJson[], keepDone: boolean): Goal {
  const doneTasks = keepDone
    ? goal.phases.flatMap((phase) => phase.tasks.filter((task) => task.status === "done"))
    : [];
  const nextPhases = draftsToPhases(phases);
  if (doneTasks.length > 0) {
    nextPhases.unshift({
      id: newId("phase"),
      title: "已经走过的",
      order: -1,
      tasks: doneTasks,
    });
    nextPhases.forEach((phase, index) => {
      phase.order = index;
    });
  }
  return snapshotHistory(
    recalcGoal({
      ...goal,
      phases: nextPhases,
      metadata: {
        ...goal.metadata,
        lastPlanAt: nowIso(),
      },
    }),
  );
}

function friendlyError(error: unknown): string {
  if (error instanceof GrokError || error instanceof PromptParseError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "这一下没成功。歇一口气，再轻轻试一次就好。";
}

function looksLikeParkOption(label: string): boolean {
  return /放下|明天|先不|休息一下|写给明天/.test(label);
}

export const useStore = create<Store>((set, get) => {
  const snapshot = (): AppState => {
    const state = get();
    return {
      apiKey: state.apiKey,
      goals: state.goals,
      activeGoalId: state.activeGoalId,
      chatHistory: state.chatHistory,
      settings: state.settings,
    };
  };

  const persistAll = async () => {
    await persistAppState(snapshot());
  };

  const activeGoal = (): Goal | undefined => {
    const { goals, activeGoalId } = get();
    return goals.find((goal) => goal.id === activeGoalId);
  };

  const patchGoal = async (next: Goal): Promise<Goal> => {
    const saved = await putGoal(next);
    set({ goals: replaceGoal(get().goals, saved) });
    return saved;
  };

  const pushMessage = async (msg: ChatMessage) => {
    set({ chatHistory: [...get().chatHistory, msg] });
    await dbAddMessage(msg);
  };

  const pushAssistant = async (
    content: string,
    mode?: ChatMessage["mode"],
    relatedGoalId?: string,
  ) => {
    await pushMessage(
      makeMsg("assistant", content, {
        mode,
        relatedGoalId: relatedGoalId ?? get().activeGoalId ?? undefined,
      }),
    );
  };

  const requireKey = (): string => {
    const key = get().apiKey?.trim() ?? "";
    if (!key) {
      throw new GrokError(
        "还没有填 API Key。在设置里贴上你自己的 xAI Key，我们就能开始。",
        "auth",
      );
    }
    return key;
  };

  const model = (): string => get().settings.preferredModel || DEFAULT_SETTINGS.preferredModel;

  const fail = async (error: unknown) => {
    const message = friendlyError(error);
    const auth = error instanceof GrokError && error.code === "auth";
    set({
      error: message,
      busy: false,
      showKeySettings: auth ? true : get().showKeySettings,
    });
    await pushAssistant(message);
  };

  const runPlan = async (goal: Goal, description = goal.description) => {
    const raw = await callGrok(
      planMessages({
        type: goal.type,
        title: goal.title,
        description,
        mood: goal.currentMood,
      }),
      requireKey(),
      model(),
    );
    const plan = parsePlanResponse(raw);
    const next = await patchGoal(applyPlan(goal, plan.phases, false));
    set({ pendingProbe: null, pendingGuided: null });
    await pushAssistant(plan.mentorMessage, "normal", next.id);
    await persistAll();
    return next;
  };

  const runProbe = async (goal: Goal) => {
    const raw = await callGrok(
      probeMessages({
        title: goal.title,
        description: goal.description,
        priorAnswers: Array.isArray(goal.metadata?.probePairs)
          ? (goal.metadata.probePairs as Array<{ question: string; answer: string }>)
          : undefined,
      }),
      requireKey(),
      model(),
    );
    const probe = parseProbeResponse(raw);
    const phases: Phase[] =
      probe.placeholderPhases.length > 0
        ? probe.placeholderPhases.map((phase, index) => ({
            id: newId("phase"),
            title: phase.title,
            description: phase.description,
            order: index,
            isPlaceholder: true,
            tasks: [],
          }))
        : goal.phases;
    const next = await patchGoal(
      recalcGoal({
        ...goal,
        phases,
        metadata: {
          ...goal.metadata,
          probeQuestions: probe.questions,
        },
      }),
    );
    set({ pendingProbe: probe.questions, pendingGuided: null });
    await pushAssistant(probe.mentorMessage, "probe", next.id);
    await persistAll();
    return next;
  };

  const runReplan = async (goal: Goal, userText?: string, reason?: string) => {
    const raw = await callGrok(
      replanMessages({
        type: goal.type,
        goalTitle: goal.title,
        mood: goal.currentMood,
        userText,
        reason,
        phases: goal.phases.map((phase) => ({
          title: phase.title,
          isPlaceholder: phase.isPlaceholder,
          tasks: phase.tasks.map((task) => ({
            title: task.title,
            status: task.status,
            estimatedMinutes: task.estimatedMinutes,
            weight: task.weight,
          })),
        })),
      }),
      requireKey(),
      model(),
    );
    const plan = parseReplanResponse(raw);
    const next = await patchGoal(applyPlan(goal, plan.phases, true));
    set({ pendingGuided: null, pendingProbe: null });
    await pushAssistant(plan.mentorMessage, "replan", next.id);
    await persistAll();
    return next;
  };

  const runGuided = async (goal: Goal, userText: string, stuckOn?: string) => {
    const raw = await callGrok(
      guidedMessages({
        goalTitle: goal.title,
        mood: goal.currentMood,
        userText,
        stuckOn,
        todayTasks: pickTodayTasks(goal).map((task) => task.title),
      }),
      requireKey(),
      model(),
    );
    const guided = parseGuidedResponse(raw);
    set({ pendingGuided: guided.options.slice(0, 3) });
    await pushAssistant(guided.mentorMessage, "guided", goal.id);
  };

  const maybeDetectMood = async (text: string) => {
    const goal = activeGoal();
    if (!goal || !looksLikeMoodSignal(text)) return;
    try {
      const raw = await callGrok(
        moodMessages({
          currentMood: goal.currentMood,
          userText: text,
        }),
        requireKey(),
        model(),
      );
      const mood = parseMoodResponse(raw, goal.currentMood);
      if (mood.shouldAsk && mood.detectedMood !== goal.currentMood) {
        set({ pendingMoodAsk: { mood: mood.detectedMood, message: mood.askMessage } });
        await pushAssistant(mood.askMessage);
      }
    } catch {
      // Mood detection is best-effort and must never block the main loop.
    }
  };

  const localChatReply = (goal: Goal | undefined): string => {
    if (!goal) {
      return "还没有目标。先写下一件想做的小事就好。";
    }
    const today = pickTodayTasks(goal);
    if (today.length === 0) {
      return "今天清单是空的。想休息就休息。想走一步的话，跟我说「加个任务」或「重新规划」。";
    }
    const list = today.map((task, index) => `${index + 1}. ${task.title}`).join("\n");
    return `我在这儿。今天只看这几步就够了：\n${list}\n\n卡住了就说「卡住了」，想改计划就说「重新规划」。`;
  };

  return {
    ...EMPTY_APP_STATE,
    hydrated: false,
    busy: false,
    error: null,
    showKeySettings: false,
    creatingGoal: false,
    pendingGuided: null,
    pendingMoodAsk: null,
    pendingProbe: null,

    hydrate: async () => {
      try {
        const loaded = await loadAppState();
        set({
          ...loaded,
          hydrated: true,
          creatingGoal: loaded.goals.length === 0,
        });
      } catch (error) {
        set({
          hydrated: true,
          creatingGoal: true,
          error: friendlyError(error),
        });
      }
    },

    setApiKey: async (key: string) => {
      const apiKey = key.trim();
      set({ apiKey, showKeySettings: false, error: null });
      await dbSetApiKey(apiKey);
      await saveSettings({ apiKey });
    },

    clearApiKey: async () => {
      set({ apiKey: null, showKeySettings: true });
      await dbSetApiKey(null);
      await saveSettings({ apiKey: null });
    },

    setShowKeySettings: (show: boolean) => set({ showKeySettings: show }),

    startNewGoal: () =>
      set({
        creatingGoal: true,
        pendingProbe: null,
        pendingGuided: null,
        pendingMoodAsk: null,
      }),

    cancelCreate: () => set({ creatingGoal: false }),

    createGoal: async (input: CreateGoalInput) => {
      const goal: Goal = {
        id: newId("goal"),
        type: input.type,
        title: input.title.trim(),
        description: input.description.trim(),
        targetDate: input.targetDate || undefined,
        createdAt: nowIso(),
        currentMood: input.mood,
        phases: [],
        overallProgress: 0,
        totalWeight: 0,
        completedWeight: 0,
        history: [],
        metadata: {},
      };
      const saved = await putGoal(goal);
      await setActiveGoalId(saved.id);
      set({
        goals: replaceGoal(get().goals, saved),
        activeGoalId: saved.id,
        creatingGoal: false,
        busy: true,
        error: null,
        pendingProbe: null,
        pendingGuided: null,
        pendingMoodAsk: null,
      });
      await pushMessage(
        makeMsg(
          "user",
          `我想开始一个${saved.type === "habit" ? "习惯" : "项目"}：${saved.title}`,
          { relatedGoalId: saved.id },
        ),
      );
      try {
        if (saved.type === "project") {
          await runProbe(saved);
        } else {
          await runPlan(saved);
        }
      } catch (error) {
        await fail(error);
      } finally {
        set({ busy: false });
      }
    },

    setActiveGoal: async (id: string) => {
      set({
        activeGoalId: id,
        creatingGoal: false,
        pendingGuided: null,
        pendingProbe: null,
        pendingMoodAsk: null,
      });
      await setActiveGoalId(id);
    },

    completeTask: async (taskId: string) => {
      const goal = activeGoal();
      if (!goal) return;
      const marked = mapTask(goal, taskId, (task) => ({
        ...task,
        status: "done" as const,
        completedAt: task.completedAt ?? nowIso(),
      }));
      const progressed = applyProgress(marked);
      const next = upsertTodaySnapshot(progressed, todayDate());
      await patchGoal(next);
    },

    skipTask: async (taskId: string) => {
      const goal = activeGoal();
      if (!goal) return;
      await patchGoal(setTaskStatus(goal, taskId, "skipped"));
    },

    addChat: async (input) => {
      const message = makeMsg(input.role, input.content, input);
      await pushMessage(message);
      return message;
    },

    addTask: async (draft) => {
      const goal = activeGoal();
      if (!goal) return null;
      const task = draftTask(
        {
          title: draft.title.trim() || "新的一小步",
          description: draft.description,
          estimatedMinutes: draft.estimatedMinutes ?? 15,
          weight: draft.weight ?? 5,
        },
        draft.status ?? "pending",
      );
      await patchGoal(addTaskToGoal(goal, task));
      return task;
    },

    applyPlanJson: async (plan, keepFinished = false) => {
      const goal = activeGoal();
      if (!goal) return undefined;
      return patchGoal(applyPlan(goal, plan.phases, keepFinished));
    },

    applyReplan: async (replan) => {
      const goal = activeGoal();
      if (!goal) return undefined;
      const saved = await patchGoal(
        applyPlan(
          {
            ...goal,
            metadata: { ...goal.metadata, lastReplanReason: replan.reason },
          },
          replan.phases,
          true,
        ),
      );
      return saved;
    },

    setMood: async (mood: MoodState) => {
      const goal = activeGoal();
      if (!goal) return;
      await patchGoal(snapshotHistory({ ...goal, currentMood: mood }));
      set({ pendingMoodAsk: null });
    },

    confirmMoodChange: async (accept: boolean) => {
      const pending = get().pendingMoodAsk;
      set({ pendingMoodAsk: null });
      if (!accept || !pending) {
        await pushAssistant("好，标签先不动。");
        return;
      }
      const goal = activeGoal();
      if (!goal) return;
      await patchGoal(snapshotHistory({ ...goal, currentMood: pending.mood }));
      await pushAssistant(`好，我把心情标签改成「${MOOD_LABEL[pending.mood]}」。`);
    },

    retryPlan: async () => {
      const goal = activeGoal();
      if (!goal || get().busy) return;
      set({ busy: true, error: null });
      try {
        await runPlan(goal);
      } catch (error) {
        await fail(error);
      } finally {
        set({ busy: false });
      }
    },

    sendChat: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || get().busy) return;

      const pendingMood = get().pendingMoodAsk;
      if (pendingMood && /^(好|改|嗯|可以|行|改吧|好的|嗯嗯|好啊)([。.!！]?)$/.test(trimmed)) {
        await get().confirmMoodChange(true);
        return;
      }
      if (pendingMood && /^(不|先不|不用|维持|算了|不要|先这样)/.test(trimmed)) {
        await get().confirmMoodChange(false);
        return;
      }

      const userMsg = makeMsg("user", trimmed, { relatedGoalId: get().activeGoalId ?? undefined });
      set({
        chatHistory: [...get().chatHistory, userMsg],
        busy: true,
        error: null,
        pendingGuided: null,
      });
      await dbAddMessage(userMsg);

      const intent = detectIntent(trimmed);
      const goal = activeGoal();

      try {
        if (intent === "stuck") {
          if (!goal) {
            await pushAssistant("还没有目标。先写下一件想做的小事就好。");
          } else {
            const today = pickTodayTasks(goal);
            await runGuided(goal, trimmed, today[0]?.title);
          }
        } else if (intent === "replan") {
          if (!goal) {
            await pushAssistant("还没有目标可以重排。先创建一个就好。");
          } else {
            await runReplan(goal, trimmed);
          }
        } else if (intent === "extra_done") {
          if (!goal) {
            await pushAssistant("先有一个目标，我才能帮你记下来。");
          } else {
            const title = extractExtraTitle(trimmed);
            const matched = findMatchingPending(goal, title);
            const next = matched
              ? setTaskStatus(goal, matched.id, "done")
              : addTaskToGoal(
                  goal,
                  draftTask(
                    {
                      title: title || "额外完成的一小步",
                      estimatedMinutes: 15,
                      weight: 4,
                    },
                    "done",
                  ),
                );
            await patchGoal(next);
            await pushAssistant("记下了。这一步也算数。今天已经够好了。");
          }
        } else if (intent === "add_task") {
          if (!goal) {
            await pushAssistant("先有一个目标，我才能加任务。");
          } else {
            const title = extractNewTaskTitle(trimmed);
            const next = addTaskToGoal(
              goal,
              draftTask({
                title: title || "新的一小步",
                estimatedMinutes: 15,
                weight: 5,
              }),
            );
            await patchGoal(next);
            await pushAssistant(
              `好，我把「${title || "新的一小步"}」放进清单了。想做再做，不着急。`,
            );
          }
        } else {
          await pushAssistant(localChatReply(goal));
        }
        void maybeDetectMood(trimmed);
      } catch (error) {
        await fail(error);
      } finally {
        set({ busy: false });
      }
    },

    chooseGuided: async (optionId: string) => {
      const option = get().pendingGuided?.find((item) => item.id === optionId);
      if (!option || get().busy) return;
      const userText = `我选 ${option.id}：${option.label}`;
      const userMsg = makeMsg("user", userText, {
        relatedGoalId: get().activeGoalId ?? undefined,
        mode: "guided",
      });
      set({
        chatHistory: [...get().chatHistory, userMsg],
        pendingGuided: null,
        busy: true,
        error: null,
      });
      await dbAddMessage(userMsg);
      try {
        const goal = activeGoal();
        if (goal && !looksLikeParkOption(option.label)) {
          const matched = findMatchingPending(goal, option.label);
          if (!matched) {
            await patchGoal(
              addTaskToGoal(
                goal,
                draftTask({
                  title: option.label,
                  description: option.hint,
                  estimatedMinutes: 10,
                  weight: 3,
                }),
              ),
            );
          }
        }
        await pushAssistant(
          looksLikeParkOption(option.label)
            ? "好，这一步先放下。任务还在，明天的你再决定。"
            : `好，那就这一步：${option.label}。做完了跟我说一声就好。`,
          "guided",
        );
      } catch (error) {
        await fail(error);
      } finally {
        set({ busy: false });
      }
    },

    answerProbe: async (answers: Record<string, string>) => {
      const goal = activeGoal();
      if (!goal || get().busy) return;
      const questions = get().pendingProbe ?? [];
      const pairs = questions
        .map((question) => ({
          question: question.question,
          answer: (answers[question.id] ?? "").trim(),
        }))
        .filter((item) => item.answer);
      const summary = pairs.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n");
      const userMsg = makeMsg("user", `项目补充：\n${summary || "先这样。"}`, {
        relatedGoalId: goal.id,
        mode: "probe",
      });
      set({
        chatHistory: [...get().chatHistory, userMsg],
        pendingProbe: null,
        busy: true,
        error: null,
      });
      await dbAddMessage(userMsg);
      try {
        const nextGoal: Goal = {
          ...goal,
          description: [goal.description, summary && `补充：\n${summary}`].filter(Boolean).join("\n\n"),
          metadata: {
            ...goal.metadata,
            probeAnswers: answers,
            probePairs: pairs,
          },
        };
        const saved = await patchGoal(nextGoal);
        await runPlan(saved, saved.description);
      } catch (error) {
        await fail(error);
      } finally {
        set({ busy: false });
      }
    },

    dismissError: () => set({ error: null }),

    exportJson: async () => exportAppJson(),
  };
});

export function selectActiveGoal(state: Store): Goal | undefined {
  return state.goals.find((goal) => goal.id === state.activeGoalId);
}

export { EMPTY_TODAY_TASKS };

export function selectTodayTasks(state: Store): AtomicTask[] {
  const goal = selectActiveGoal(state);
  return goal ? pickTodayTasks(goal) : EMPTY_TODAY_TASKS;
}
