// Shared presentational types for the TinySteps Sprint 1 UI kit.
// UI copy is Chinese; comments stay English. No store types live here.

/** Self-reported energy / affect. Never labeled 消极. */
export type Mood = "up" | "ok" | "low";

export type GoalType = "habit" | "project";

export type TaskStatus = "pending" | "done" | "skipped";

export type ChatRole = "user" | "assistant";

export type GuidedKey = "A" | "B" | "C";

/** One of today's 1-3 visible steps. */
export interface TodayTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  status: TaskStatus;
}

/** Visible chat turn. System / tool messages stay out of this kit. */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** A/B/C choice when the mentor offers a smaller next move. */
export interface GuidedOption {
  id: string;
  key: GuidedKey;
  label: string;
  description?: string;
}

/** Payload GoalCreator emits. River / Flow persist it. */
export interface GoalDraft {
  type: GoalType;
  title: string;
  description: string;
  targetDate?: string;
  mood: Mood;
}

export const MOOD_LABELS: Record<Mood, string> = {
  up: "还不错",
  ok: "还好",
  low: "有点沉",
};

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  habit: "习惯型",
  project: "项目型",
};
