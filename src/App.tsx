import { useEffect, useMemo, useState } from "react";
import {
  ApiKeySetup,
  ChatPanel,
  ExportButton,
  GoalCreator,
  MoodTag,
  ProgressRing,
  TodayTasks,
  type GoalDraft,
  type GuidedKey,
  type GuidedOption,
  type Mood,
} from "./ui/index.ts";
import { MOOD_LABEL, type MoodState } from "./types.ts";
import { useShallow } from "zustand/react/shallow";
import { selectActiveGoal, selectTodayTasks, useStore } from "./store.ts";

const UI_TO_STORE: Record<Mood, MoodState> = {
  up: "positive",
  ok: "neutral",
  low: "negative",
};

const STORE_TO_UI: Record<MoodState, Mood> = {
  positive: "up",
  neutral: "ok",
  negative: "low",
};

const GUIDED_KEYS: GuidedKey[] = ["A", "B", "C"];

function asGuidedKey(id: string, index: number): GuidedKey {
  return GUIDED_KEYS.includes(id as GuidedKey) ? (id as GuidedKey) : (GUIDED_KEYS[index] ?? "A");
}

export default function App() {
  const hydrate = useStore((state) => state.hydrate);
  const hydrated = useStore((state) => state.hydrated);
  const apiKey = useStore((state) => state.apiKey);
  const goals = useStore((state) => state.goals);
  const activeGoalId = useStore((state) => state.activeGoalId);
  const chatHistory = useStore((state) => state.chatHistory);
  const settings = useStore((state) => state.settings);
  const creatingGoal = useStore((state) => state.creatingGoal);
  const busy = useStore((state) => state.busy);
  const error = useStore((state) => state.error);
  const goal = useStore(selectActiveGoal);
  // pickTodayTasks allocates a new array; useShallow keeps Zustand v5 from looping.
  const today = useStore(useShallow(selectTodayTasks));
  const completeTask = useStore((state) => state.completeTask);
  const skipTask = useStore((state) => state.skipTask);
  const setMood = useStore((state) => state.setMood);
  const setActiveGoal = useStore((state) => state.setActiveGoal);
  const startNewGoal = useStore((state) => state.startNewGoal);
  const cancelCreate = useStore((state) => state.cancelCreate);
  const retryPlan = useStore((state) => state.retryPlan);
  const pendingMoodAsk = useStore((state) => state.pendingMoodAsk);
  const confirmMoodChange = useStore((state) => state.confirmMoodChange);
  const pendingProbe = useStore((state) => state.pendingProbe);
  const answerProbe = useStore((state) => state.answerProbe);
  const pendingGuided = useStore((state) => state.pendingGuided);
  const chooseGuided = useStore((state) => state.chooseGuided);
  const sendChat = useStore((state) => state.sendChat);
  const createGoal = useStore((state) => state.createGoal);
  const setApiKey = useStore((state) => state.setApiKey);
  const dismissError = useStore((state) => state.dismissError);

  const [probeAnswers, setProbeAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    setProbeAnswers({});
  }, [pendingProbe]);

  const visibleMessages = useMemo(
    () =>
      chatHistory
        .filter((msg): msg is typeof msg & { role: "user" | "assistant" } =>
          msg.role === "user" || msg.role === "assistant",
        )
        .filter((msg) => !goal || !msg.relatedGoalId || msg.relatedGoalId === goal.id)
        .map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
        })),
    [chatHistory, goal],
  );

  const todayTasks = useMemo(
    () =>
      today.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        estimatedMinutes: task.estimatedMinutes,
        status: task.status,
      })),
    [today],
  );

  const guidedChoices: GuidedOption[] | undefined = useMemo(() => {
    if (!pendingGuided || pendingGuided.length === 0) return undefined;
    return pendingGuided.slice(0, 3).map((option, index) => ({
      id: option.id,
      key: asGuidedKey(option.id, index),
      label: option.label,
      description: option.hint,
    }));
  }, [pendingGuided]);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper px-6 text-lg text-ink/50">
        慢慢打开…
      </div>
    );
  }

  if (!apiKey) {
    return <ApiKeySetup onSave={(key) => void setApiKey(key)} />;
  }

  if (creatingGoal || goals.length === 0 || !goal) {
    return (
      <main className="min-h-dvh bg-paper px-6 py-16 text-ink">
        <div className="mx-auto w-full max-w-xl">
          <GoalCreator
            submitting={busy}
            onSubmit={(draft: GoalDraft) =>
              void createGoal({
                type: draft.type,
                title: draft.title,
                description: draft.description,
                targetDate: draft.targetDate,
                mood: UI_TO_STORE[draft.mood],
              })
            }
          />
          {goals.length > 0 && activeGoalId ? (
            <button
              type="button"
              onClick={() => cancelCreate()}
              className="mt-6 min-h-12 w-full rounded-3xl px-5 text-lg text-ink/45 ring-1 ring-stone-deep/70 hover:bg-white hover:text-ink"
            >
              返回当前目标
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  const submitProbe = () => {
    if (!pendingProbe || busy) return;
    const filled = pendingProbe.some((item) => (probeAnswers[item.id] ?? "").trim());
    if (!filled) return;
    void answerProbe(probeAnswers);
  };

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-stone-deep/60 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <p className="mr-auto text-xl font-semibold tracking-tight">小步</p>
          <MoodTag
            value={STORE_TO_UI[goal.currentMood]}
            onChange={(mood) => void setMood(UI_TO_STORE[mood])}
          />
          <button
            type="button"
            onClick={() => startNewGoal()}
            className="min-h-12 rounded-full px-5 text-lg text-ink/55 ring-1 ring-stone-deep/80 transition hover:bg-white hover:text-ink"
          >
            新目标
          </button>
          <ExportButton
            getJson={() =>
              JSON.stringify(
                {
                  apiKey,
                  goals,
                  activeGoalId,
                  chatHistory,
                  settings,
                },
                null,
                2,
              )
            }
          />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {error ? (
          <button
            type="button"
            onClick={() => dismissError()}
            className="rounded-3xl bg-clay-mist px-5 py-4 text-left text-lg text-clay ring-1 ring-clay/30 lg:col-span-2"
          >
            {error}
            <span className="mt-1 block text-lg text-ink/40">点一下关掉</span>
          </button>
        ) : null}

        {pendingMoodAsk ? (
          <div className="rounded-3xl bg-white/80 p-5 shadow-card ring-1 ring-stone-deep/60 lg:col-span-2">
            <p className="text-lg leading-relaxed text-ink">{pendingMoodAsk.message}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmMoodChange(true)}
                className="min-h-12 rounded-full bg-white px-5 text-lg text-ink ring-1 ring-stone-deep/80 hover:bg-paper disabled:opacity-60"
              >
                好，改成「{MOOD_LABEL[pendingMoodAsk.mood]}」
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmMoodChange(false)}
                className="min-h-12 rounded-full px-5 text-lg text-ink/50 hover:text-ink disabled:opacity-60"
              >
                先不改
              </button>
            </div>
          </div>
        ) : null}

        {pendingProbe && pendingProbe.length > 0 ? (
          <form
            className="space-y-4 rounded-3xl bg-white/80 p-5 shadow-card ring-1 ring-stone-deep/60 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitProbe();
            }}
          >
            <p className="text-lg text-ink/65">先答一两句就好，不用写长。</p>
            {pendingProbe.map((item) => (
              <label key={item.id} className="block">
                <span className="mb-2 block text-lg text-ink">{item.question}</span>
                <input
                  value={probeAnswers[item.id] ?? ""}
                  onChange={(event) =>
                    setProbeAnswers((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  className="min-h-12 w-full rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 rounded-3xl px-5 text-lg text-ink ring-1 ring-stone-deep/80 hover:bg-paper disabled:opacity-60"
            >
              这样就可以
            </button>
          </form>
        ) : null}

        <div className="flex flex-col gap-10">
          {goals.length > 1 ? (
            <label className="block">
              <span className="mb-2 block text-lg text-ink/55">当前目标</span>
              <select
                value={goal.id}
                onChange={(event) => void setActiveGoal(event.target.value)}
                className="min-h-12 w-full rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink"
              >
                {goals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-2xl font-medium tracking-tight text-ink">{goal.title}</p>
          )}

          <ProgressRing
            progress={goal.overallProgress}
            completedWeight={goal.completedWeight}
            totalWeight={goal.totalWeight}
          />

          {goal.phases.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void retryPlan()}
              className="min-h-12 w-full rounded-3xl px-5 text-lg text-ink/70 ring-1 ring-stone-deep/80 hover:bg-white disabled:opacity-60"
            >
              {busy ? "正在拆分…" : "再试一次拆分"}
            </button>
          ) : null}

          <TodayTasks
            tasks={todayTasks}
            onComplete={(id) => void completeTask(id)}
            onSkip={(id) => void skipTask(id)}
          />
        </div>

        <ChatPanel
          messages={visibleMessages}
          onSend={(text) => void sendChat(text)}
          choices={guidedChoices}
          onChoose={(id) => void chooseGuided(id)}
          disabled={busy}
        />
      </main>
    </div>
  );
}
