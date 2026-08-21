// src/types.ts
// TinySteps domain types. Field names and unions match the Leader spec.

export type MoodState = 'positive' | 'neutral' | 'negative';

export type TaskStatus = 'pending' | 'done' | 'skipped';

export type GoalType = 'habit' | 'project';

export type ChatRole = 'user' | 'assistant' | 'system';

export type ChatMode = 'normal' | 'guided' | 'replan' | 'probe';

/** Weight is 1-10. estimatedMinutes should stay in the 10-20 atomic range. */
export interface AtomicTask {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  weight: number;
  status: TaskStatus;
  completedAt?: string;
  parentId?: string;
}

export interface Phase {
  id: string;
  title: string;
  description?: string;
  order: number;
  tasks: AtomicTask[];
  isPlaceholder?: boolean;
}

export interface ProgressSnapshot {
  date: string;
  progress: number;
  mood: MoodState;
  notes?: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  description: string;
  targetDate?: string;
  createdAt: string;
  currentMood: MoodState;
  phases: Phase[];
  overallProgress: number;
  totalWeight: number;
  completedWeight: number;
  history: ProgressSnapshot[];
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  relatedGoalId?: string;
  mode?: ChatMode;
}

export interface AppSettings {
  preferredModel: string;
  language: 'zh' | 'en';
}

export interface AppState {
  apiKey: string | null;
  goals: Goal[];
  activeGoalId: string | null;
  chatHistory: ChatMessage[];
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  preferredModel: 'grok-4',
  language: 'zh',
};

export const EMPTY_APP_STATE: AppState = {
  apiKey: null,
  goals: [],
  activeGoalId: null,
  chatHistory: [],
  settings: DEFAULT_SETTINGS,
};

export const MOOD_LABEL: Record<MoodState, string> = {
  positive: "还不错",
  neutral: "平静",
  negative: "偏低落",
};
