// src/lib/prompts.ts
// System prompts + strict JSON parsers for Plan / Guided / Replan / Mood / Probe.
// Mentor-facing text is Chinese. Comments stay English.

import type { GrokMessage } from './grok';

export type MoodState = 'positive' | 'neutral' | 'negative';
export type GoalType = 'habit' | 'project';
export type MentorMode = 'plan' | 'guided' | 'replan' | 'mood' | 'probe';

export interface PlanTaskJson {
  title: string;
  description: string;
  estimatedMinutes: number;
  weight: number;
}

export interface PlanPhaseJson {
  title: string;
  description: string;
  isPlaceholder: boolean;
  tasks: PlanTaskJson[];
}

export interface PlanJson {
  mode: 'plan';
  mentorMessage: string;
  phases: PlanPhaseJson[];
}

export interface GuidedOptionJson {
  id: string;
  label: string;
  hint: string;
}

export interface GuidedJson {
  mode: 'guided';
  mentorMessage: string;
  options: GuidedOptionJson[];
}

export interface ReplanJson {
  mode: 'replan';
  reason: string;
  mentorMessage: string;
  phases: PlanPhaseJson[];
}

export interface MoodJson {
  mode: 'mood';
  detectedMood: MoodState;
  shouldAsk: boolean;
  askMessage: string;
}

export interface ProbeQuestionJson {
  id: string;
  question: string;
}

export interface ProbePhaseJson {
  title: string;
  description: string;
}

export interface ProbeJson {
  mode: 'probe';
  mentorMessage: string;
  questions: ProbeQuestionJson[];
  placeholderPhases: ProbePhaseJson[];
}

export interface PlanInput {
  type: GoalType;
  title: string;
  description: string;
  mood: MoodState;
}

export interface GuidedInput {
  goalTitle: string;
  mood: MoodState;
  userText: string;
  stuckOn?: string;
  todayTasks?: string[];
}

export interface ReplanPhaseInput {
  title: string;
  isPlaceholder?: boolean;
  tasks: Array<{
    title: string;
    status: string;
    estimatedMinutes: number;
    weight: number;
  }>;
}

export interface ReplanInput {
  type: GoalType;
  goalTitle: string;
  mood: MoodState;
  phases: ReplanPhaseInput[];
  userText?: string;
  reason?: string;
}

export interface MoodInput {
  currentMood: MoodState;
  userText: string;
}

export interface ProbeInput {
  title: string;
  description: string;
  priorAnswers?: Array<{ question: string; answer: string }>;
}

export class PromptParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptParseError';
  }
}

const MOOD_LABEL: Record<MoodState, string> = {
  positive: '还不错',
  neutral: '平常',
  negative: '有点沉',
};

const SHARED_RULES = `You are TinySteps, a calm local-first mentor.
Speak to the user only in Simplified Chinese (mentorMessage / askMessage / questions / option labels).
Never shame, never rush, never scold, never compare the user to others.
Never mention deadlines, due dates, streaks to keep, "must finish today", or falling behind.
Never use 加油冲刺 / 必须完成 / 你落后了 / 截止日期 / 再不做就来不及.
Tasks you invent are atomic: 10-20 minutes, one visible action, weight 1-10.
Adjust density and tone by MoodState:
- negative: softer, smaller first step, fewer tasks in the first phase (about 1 easy start).
- neutral: steady, 2 small steps in the first phase.
- positive: still tiny, up to 3 first-phase tasks. Do not pile on.
When the user is stuck, only offer 2-4 concrete A/B/C actions. No open-ended essays.
Return ONE JSON object only. No markdown, no code fences, no extra keys beyond the schema.`;

export const PLAN_SYSTEM = `${SHARED_RULES}

Mode: plan.
Build a weighted atomic task tree for a new goal.
Habit: one real phase, no placeholders, 3-5 tiny tasks.
Project: 2-4 phases. Only the first phase is fully concrete. Later phases may set isPlaceholder=true with 1 sketch task.
Do not invent ids. Do not estimate overall progress.
Schema:
{
  "mode": "plan",
  "mentorMessage": "短、暖、中文。告诉用户今天只需迈出眼前这一小步。",
  "phases": [
    {
      "title": "",
      "description": "",
      "isPlaceholder": false,
      "tasks": [
        { "title": "", "description": "", "estimatedMinutes": 15, "weight": 5 }
      ]
    }
  ]
}`;

export const GUIDED_SYSTEM = `${SHARED_RULES}

Mode: guided.
The user is stuck. Offer ONLY 2-4 concrete, immediately doable options.
Each option is a single action they can start in under 10 minutes.
Always include one "更小一步" option and one "先放下、写给明天的自己" option.
Ids must be A, B, C, D in order.
Schema:
{
  "mode": "guided",
  "mentorMessage": "短、暖、中文。承认卡住很常见，不必硬推。",
  "options": [
    { "id": "A", "label": "具体可执行的一小步", "hint": "一句补充" }
  ]
}`;

export const REPLAN_SYSTEM = `${SHARED_RULES}

Mode: replan.
Keep done/skipped tasks as already finished history in spirit: do not re-ask the user to redo them.
Rebuild remaining work into a gentler tree. First phase stays tiny. Later phases may be placeholders.
Schema:
{
  "mode": "replan",
  "reason": "一句话说明为什么收一收（中文）",
  "mentorMessage": "短、暖、中文。肯定已有的一点进展，说明今天变短了。",
  "phases": [
    {
      "title": "",
      "description": "",
      "isPlaceholder": false,
      "tasks": [
        { "title": "", "description": "", "estimatedMinutes": 15, "weight": 5 }
      ]
    }
  ]
}`;

export const MOOD_SYSTEM = `${SHARED_RULES}

Mode: mood (internal). Never dump this JSON to the chat as-is.
Detect tone from the latest user text. shouldAsk is true ONLY when the detected mood clearly differs from the current tag.
askMessage is a polite yes/no, never a diagnosis.
Schema:
{
  "mode": "mood",
  "detectedMood": "positive" | "neutral" | "negative",
  "shouldAsk": true,
  "askMessage": "我觉得你的状态可能变了，要把标签改成「有点沉」吗？当然也可以维持原样。"
}`;

export const PROBE_SYSTEM = `${SHARED_RULES}

Mode: probe.
Used when a project is too vague to plan safely.
Ask 1-3 short, concrete questions (not essays). Also sketch 2-4 placeholder later phases.
Do not invent a full task tree yet.
Schema:
{
  "mode": "probe",
  "mentorMessage": "短、暖、中文。说明先问两句，好把后面的步子放准。",
  "questions": [{ "id": "q1", "question": "一句好答的问题" }],
  "placeholderPhases": [{ "title": "", "description": "" }]
}`;

export function planMessages(input: PlanInput): GrokMessage[] {
  const note = input.description.trim() || '（用户没有补充说明）';
  return [
    { role: 'system', content: PLAN_SYSTEM },
    {
      role: 'user',
      content: [
        `目标类型：${input.type === 'habit' ? '习惯' : '项目'}`,
        `标题：${input.title.trim()}`,
        `说明：${note}`,
        `当前状态标签：${input.mood}（${MOOD_LABEL[input.mood]}）`,
        '请按 schema 返回 plan JSON。',
      ].join('\n'),
    },
  ];
}

export function guidedMessages(input: GuidedInput): GrokMessage[] {
  const today =
    input.todayTasks && input.todayTasks.length > 0
      ? input.todayTasks.map((t, i) => `${i + 1}. ${t}`).join('\n')
      : '（今天还没有列出任务）';
  return [
    { role: 'system', content: GUIDED_SYSTEM },
    {
      role: 'user',
      content: [
        `目标：${input.goalTitle.trim()}`,
        `当前状态标签：${input.mood}（${MOOD_LABEL[input.mood]}）`,
        `卡在：${input.stuckOn?.trim() || '未指明具体任务'}`,
        `用户原话：${input.userText.trim() || '我卡住了'}`,
        `今日任务：\n${today}`,
        '请按 schema 返回 guided JSON，2-4 个选项。',
      ].join('\n'),
    },
  ];
}

export function replanMessages(input: ReplanInput): GrokMessage[] {
  const tree = input.phases
    .map((phase, index) => {
      const flag = phase.isPlaceholder ? ' [placeholder]' : '';
      const tasks = phase.tasks
        .map((task) => `  - [${task.status}] ${task.title} (${task.estimatedMinutes}m, w${task.weight})`)
        .join('\n');
      return `${index + 1}. ${phase.title}${flag}\n${tasks || '  (no tasks)'}`;
    })
    .join('\n');
  return [
    { role: 'system', content: REPLAN_SYSTEM },
    {
      role: 'user',
      content: [
        `目标类型：${input.type === 'habit' ? '习惯' : '项目'}`,
        `标题：${input.goalTitle.trim()}`,
        `当前状态标签：${input.mood}（${MOOD_LABEL[input.mood]}）`,
        `用户原话：${input.userText?.trim() || '想重新规划一下'}`,
        `补充原因：${input.reason?.trim() || '未说明'}`,
        `现有任务树：\n${tree || '（空）'}`,
        '请按 schema 返回 replan JSON。已完成的不要再列成待做。',
      ].join('\n'),
    },
  ];
}

export function moodMessages(input: MoodInput): GrokMessage[] {
  return [
    { role: 'system', content: MOOD_SYSTEM },
    {
      role: 'user',
      content: [
        `当前标签：${input.currentMood}（${MOOD_LABEL[input.currentMood]}）`,
        `用户原话：${input.userText.trim()}`,
        '请按 schema 返回 mood JSON。只有明显变化才 shouldAsk=true。',
      ].join('\n'),
    },
  ];
}

export function probeMessages(input: ProbeInput): GrokMessage[] {
  const prior =
    input.priorAnswers && input.priorAnswers.length > 0
      ? input.priorAnswers.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n')
      : '（还没有追问过）';
  return [
    { role: 'system', content: PROBE_SYSTEM },
    {
      role: 'user',
      content: [
        `项目标题：${input.title.trim()}`,
        `已知说明：${input.description.trim() || '（很少）'}`,
        `已有问答：\n${prior}`,
        '请按 schema 返回 probe JSON。问题要短、好答。',
      ].join('\n'),
    },
  ];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new PromptParseError('模型回了内容，但不是可用的规划。再试一次就好。');
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseTask(value: unknown): PlanTaskJson {
  const rec = asRecord(value);
  const title = asString(rec.title);
  if (!title) {
    throw new PromptParseError('有一步任务没有名字。再生成一次就好。');
  }
  return {
    title,
    description: asString(rec.description),
    estimatedMinutes: clampInt(rec.estimatedMinutes, 10, 20, 15),
    weight: clampInt(rec.weight, 1, 10, 5),
  };
}

function parsePhase(value: unknown): PlanPhaseJson {
  const rec = asRecord(value);
  const title = asString(rec.title);
  if (!title) {
    throw new PromptParseError('有一个阶段没有标题。再生成一次就好。');
  }
  const tasks = asArray(rec.tasks).map(parseTask);
  if (tasks.length === 0) {
    throw new PromptParseError('有一个阶段里没有任务。再生成一次就好。');
  }
  return {
    title,
    description: asString(rec.description),
    isPlaceholder: asBool(rec.isPlaceholder, false),
    tasks,
  };
}

function parsePhases(value: unknown): PlanPhaseJson[] {
  const phases = asArray(value).map(parsePhase);
  if (phases.length === 0) {
    throw new PromptParseError('这次没有拆出阶段。再试一次就好。');
  }
  return phases;
}

function requireMentor(value: unknown): string {
  const text = asString(value);
  if (!text) {
    throw new PromptParseError('模型没有写下给用户的话。再试一次就好。');
  }
  return text;
}

export function parsePlanResponse(raw: unknown): PlanJson {
  const rec = asRecord(raw);
  return {
    mode: 'plan',
    mentorMessage: requireMentor(rec.mentorMessage ?? rec.messageToUser),
    phases: parsePhases(rec.phases),
  };
}

export function parseGuidedResponse(raw: unknown): GuidedJson {
  const rec = asRecord(raw);
  const letters = ['A', 'B', 'C', 'D'] as const;
  const options = asArray(rec.options)
    .slice(0, 4)
    .map((item, index) => {
      const opt = asRecord(item);
      const label = asString(opt.label) || asString(opt.title);
      if (!label) {
        throw new PromptParseError('有一个选项是空的。再试一次就好。');
      }
      return {
        id: letters[index] ?? 'A',
        label,
        hint: asString(opt.hint ?? opt.description),
      };
    });
  if (options.length < 2) {
    throw new PromptParseError('卡住时至少需要两个可选项。再试一次就好。');
  }
  return {
    mode: 'guided',
    mentorMessage: requireMentor(rec.mentorMessage ?? rec.messageToUser),
    options,
  };
}

export function parseReplanResponse(raw: unknown): ReplanJson {
  const rec = asRecord(raw);
  return {
    mode: 'replan',
    reason: asString(rec.reason) || '先把今天的步子收短一点。',
    mentorMessage: requireMentor(rec.mentorMessage ?? rec.messageToUser),
    phases: parsePhases(rec.phases),
  };
}

function parseMoodState(value: unknown): MoodState {
  const raw = asString(value).toLowerCase();
  if (raw === 'positive' || raw === 'neutral' || raw === 'negative') return raw;
  if (/积极|开心|有劲|不错/.test(raw)) return 'positive';
  if (/沉|低|累|焦虑|负面/.test(raw)) return 'negative';
  return 'neutral';
}

export function parseMoodResponse(raw: unknown, currentMood?: MoodState): MoodJson {
  const rec = asRecord(raw);
  const detectedMood = parseMoodState(rec.detectedMood ?? rec.detected);
  const same = currentMood !== undefined && currentMood === detectedMood;
  const shouldAsk = same ? false : asBool(rec.shouldAsk, detectedMood !== 'neutral');
  const fallbackAsk =
    detectedMood === 'negative'
      ? '我觉得你这会儿可能有点沉。要把状态标签改成「有点沉」吗？维持原样也完全可以。'
      : detectedMood === 'positive'
        ? '听起来你这边还挺有劲。要把状态标签改成「还不错」吗？不想改也没关系。'
        : '要不要把状态标签调回「平常」？不想动就保持现在这样。';
  return {
    mode: 'mood',
    detectedMood,
    shouldAsk,
    askMessage: shouldAsk ? asString(rec.askMessage) || fallbackAsk : asString(rec.askMessage),
  };
}

export function parseProbeResponse(raw: unknown): ProbeJson {
  const rec = asRecord(raw);
  const questions = asArray(rec.questions)
    .slice(0, 3)
    .map((item, index) => {
      const q = asRecord(item);
      const question = asString(q.question ?? q.title);
      if (!question) {
        throw new PromptParseError('有一个追问是空的。再试一次就好。');
      }
      return { id: asString(q.id) || `q${index + 1}`, question };
    });
  if (questions.length === 0) {
    throw new PromptParseError('这次没有提出追问。再试一次就好。');
  }
  const placeholderPhases = asArray(rec.placeholderPhases).map((item, index) => {
    const phase = asRecord(item);
    return {
      title: asString(phase.title) || `后续阶段 ${index + 1}`,
      description: asString(phase.description),
    };
  });
  return {
    mode: 'probe',
    mentorMessage: requireMentor(rec.mentorMessage ?? rec.messageToUser),
    questions,
    placeholderPhases,
  };
}

export function todayTaskCount(mood: MoodState): number {
  if (mood === 'negative') return 1;
  if (mood === 'positive') return 3;
  return 2;
}
