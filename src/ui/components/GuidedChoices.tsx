import type { GuidedOption } from "../types";

export interface GuidedChoicesProps {
  options: GuidedOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function GuidedChoices({ options, onSelect, disabled }: GuidedChoicesProps) {
  if (options.length === 0) return null;

  return (
    <div className="grid gap-3" role="group" aria-label="可以选的一小步">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option.id)}
          className="flex min-h-12 w-full items-start gap-4 rounded-3xl bg-paper px-5 py-4 text-left ring-1 ring-stone-deep/80 transition hover:bg-stone/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden
            className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone text-lg font-semibold text-ink"
          >
            {option.key}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-medium text-ink">{option.label}</span>
            {option.description && (
              <span className="mt-1 block text-lg leading-relaxed text-ink/55">
                {option.description}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
