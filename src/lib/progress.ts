// src/lib/progress.ts
// Deterministic weight math. Never ask the LLM for a progress percent.

import type { AtomicTask, Goal, MoodState, Phase, ProgressSnapshot } from '../types';

export interface WeightSummary {
  totalWeight: number;
  completedWeight: number;
  overallProgress: number;
}

function allTasks(phases: Phase[]): AtomicTask[] {
  return phases.flatMap((phase) => phase.tasks);
}

/** completedWeight = sum of weights where status === 'done'. Skipped does not count. */
export function computeWeights(phases: Phase[]): WeightSummary {
  const tasks = allTasks(phases);
  let totalWeight = 0;
  let completedWeight = 0;

  for (const task of tasks) {
    totalWeight += task.weight;
    if (task.status === 'done') {
      completedWeight += task.weight;
    }
  }

  const overallProgress =
    totalWeight === 0 ? 0 : Math.round((completedWeight / totalWeight) * 100);

  return { totalWeight, completedWeight, overallProgress };
}

/** Copy a goal with freshly computed weight fields. */
export function applyProgress(goal: Goal): Goal {
  return { ...goal, ...computeWeights(goal.phases) };
}

/** Today's task count by mood: negative=1, neutral=2, positive=3. */
export function moodTaskLimit(mood: MoodState): number {
  if (mood === 'negative') return 1;
  if (mood === 'positive') return 3;
  return 2;
}

/**
 * First phase (by order) that still has pending tasks.
 * Then the smallest estimatedMinutes first, capped by mood.
 */
export function pickTodayTasks(goal: Pick<Goal, 'phases' | 'currentMood'>): AtomicTask[] {
  const limit = moodTaskLimit(goal.currentMood);
  const phases = [...goal.phases].sort((a, b) => a.order - b.order);
  const phase = phases.find((item) =>
    !item.isPlaceholder && item.tasks.some((task) => task.status === 'pending'),
  );

  if (!phase) return [];

  return [...phase.tasks]
    .filter((task) => task.status === 'pending')
    .sort((a, b) => {
      if (a.estimatedMinutes !== b.estimatedMinutes) {
        return a.estimatedMinutes - b.estimatedMinutes;
      }
      if (a.weight !== b.weight) return a.weight - b.weight;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

/** Upsert today's snapshot (YYYY-MM-DD) after a progress or mood change. */
export function upsertTodaySnapshot(
  goal: Goal,
  date: string,
  notes?: string,
): Goal {
  const next = applyProgress(goal);
  const snapshot: ProgressSnapshot = {
    date,
    progress: next.overallProgress,
    mood: next.currentMood,
    ...(notes ? { notes } : {}),
  };
  const history = next.history.filter((item) => item.date !== date);
  history.push(snapshot);
  return { ...next, history };
}
