import { describe, expect, it } from "vitest";
import { EMPTY_APP_STATE, type Goal } from "./types.ts";
import { selectTodayTasks, useStore } from "./store.ts";

function goalWithPendingTask(): Goal {
  return {
    id: "goal_1",
    type: "habit",
    title: "散步",
    description: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    currentMood: "neutral",
    phases: [
      {
        id: "phase_1",
        title: "眼前这一步",
        order: 0,
        tasks: [
          {
            id: "task_1",
            title: "出门走十分钟",
            estimatedMinutes: 10,
            weight: 3,
            status: "pending",
          },
        ],
      },
    ],
    overallProgress: 0,
    totalWeight: 3,
    completedWeight: 0,
    history: [],
  };
}

describe("selectTodayTasks", () => {
  it("returns the same empty array reference when there is no active goal", () => {
    const state = useStore.getState();
    expect(state.goals).toEqual([]);
    expect(state.activeGoalId).toBeNull();

    const first = selectTodayTasks(state);
    const second = selectTodayTasks(state);

    expect(first).toEqual([]);
    expect(first).toBe(second);
  });

  it("returns the same empty array reference for EMPTY_APP_STATE", () => {
    const first = selectTodayTasks({
      ...useStore.getState(),
      ...EMPTY_APP_STATE,
    });
    const second = selectTodayTasks({
      ...useStore.getState(),
      ...EMPTY_APP_STATE,
    });

    expect(first).toBe(second);
  });

  it("keeps the same task objects when the active goal has not changed", () => {
    const goal = goalWithPendingTask();
    const state = {
      ...useStore.getState(),
      goals: [goal],
      activeGoalId: goal.id,
    };

    const first = selectTodayTasks(state);
    const second = selectTodayTasks(state);

    expect(first).toHaveLength(1);
    expect(first[0]).toBe(goal.phases[0]?.tasks[0]);
    expect(first).toEqual(second);
    expect(first.every((task, index) => task === second[index])).toBe(true);
  });
});
