import type { Mood } from "../types";
import { MOOD_LABELS } from "../types";

export interface MoodTagProps {
  value: Mood;
  onChange: (mood: Mood) => void;
  disabled?: boolean;
}

const OPTIONS: { value: Mood; tone: string }[] = [
  { value: "up", tone: "bg-moss-mist text-moss" },
  { value: "ok", tone: "bg-paper text-ink" },
  { value: "low", tone: "bg-clay-mist text-clay" },
];

export function MoodTag({ value, onChange, disabled }: MoodTagProps) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-3xl bg-stone/80 p-1 ring-1 ring-stone-deep/70"
      role="radiogroup"
      aria-label="心情"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-12 min-w-12 rounded-3xl px-5 text-lg font-medium transition ${
              active ? `${option.tone} shadow-sm` : "text-ink/50 hover:text-ink"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {MOOD_LABELS[option.value]}
          </button>
        );
      })}
    </div>
  );
}
