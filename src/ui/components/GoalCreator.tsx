import { useState, type FormEvent } from "react";
import type { GoalDraft, GoalType, Mood } from "../types";
import { MoodTag } from "./MoodTag";

export interface GoalCreatorProps {
  onSubmit: (draft: GoalDraft) => void;
  submitting?: boolean;
}

export function GoalCreator({ onSubmit, submitting }: GoalCreatorProps) {
  const [type, setType] = useState<GoalType>("habit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [mood, setMood] = useState<Mood>("ok");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || submitting) return;
    const draft: GoalDraft = {
      type,
      title: nextTitle,
      description: description.trim(),
      mood,
    };
    if (targetDate) draft.targetDate = targetDate;
    onSubmit(draft);
  }

  const titlePlaceholder =
    type === "habit" ? "例如：晚饭后散步十分钟" : "例如：写完一份能发出去的简历";

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={submitting}
      className="flex flex-col gap-6 rounded-3xl bg-white/80 p-8 shadow-card ring-1 ring-stone-deep/60"
    >
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">先定一个小目标</h1>
        <p className="mt-2 text-lg leading-relaxed text-ink/60">
          不用想完整路线，说清楚想靠近的事就好。
        </p>
      </header>

      <div
        className="grid grid-cols-2 gap-2 rounded-3xl bg-stone/80 p-1"
        role="group"
        aria-label="目标类型"
      >
        {(
          [
            { value: "habit", label: "习惯型" },
            { value: "project", label: "项目型" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={submitting}
            onClick={() => setType(option.value)}
            className={`min-h-12 rounded-3xl text-lg font-medium transition ${
              type === option.value ? "bg-white text-ink shadow-sm" : "text-ink/50 hover:text-ink"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-lg font-medium text-ink">我想靠近的事</span>
        <input
          required
          value={title}
          disabled={submitting}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={titlePlaceholder}
          className="mt-2 min-h-12 w-full rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="text-lg font-medium text-ink">多说一点（可选）</span>
        <textarea
          value={description}
          disabled={submitting}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="现在卡在哪里，或你希望它变成什么样。"
          className="mt-2 w-full resize-none rounded-3xl border border-stone-deep/80 bg-white px-4 py-3 text-lg text-ink disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="text-lg font-medium text-ink">希望靠近的日期（可选）</span>
        <input
          type="date"
          value={targetDate}
          disabled={submitting}
          onChange={(event) => setTargetDate(event.target.value)}
          className="mt-2 min-h-12 w-full rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink disabled:opacity-60"
        />
      </label>

      <div>
        <p className="mb-2 text-lg font-medium text-ink">此刻的状态</p>
        <MoodTag value={mood} onChange={setMood} disabled={submitting} />
      </div>

      <button
        type="submit"
        disabled={submitting || title.trim().length === 0}
        className="min-h-12 rounded-3xl bg-sage text-lg font-medium text-paper transition hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "正在生成…" : "生成今天的小步"}
      </button>
    </form>
  );
}
