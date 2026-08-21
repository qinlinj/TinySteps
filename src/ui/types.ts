// Shared presentational types for the TinySteps Sprint 1 UI kit.
// UI copy is Chinese; comments stay English. No store types live here.

export type Mood = "up" | "ok" | "low";

export type GoalType = "habit" | "project";

export type TaskStatus = "pending" | "done" | "skipped";

export type ChatRole = "user" | "assistant";

export type GuidedKey = "A" | "B" | "C";

export interface TodayTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  status: TaskStatus;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface GuidedOption {
  id: string;
  key: GuidedKey;
  label: string;
  description?: string;
}

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
