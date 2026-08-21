import type { CSSProperties } from "react";

export interface ProgressRingProps {
  progress: number;
  completedWeight?: number;
  totalWeight?: number;
  caption?: string;
}

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function ProgressRing({
  progress,
  completedWeight,
  totalWeight,
  caption = "今天的进度",
}: ProgressRingProps) {
  const clamped = clampProgress(progress);
  const rounded = Math.round(clamped);
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const walked = completedWeight ?? 0;
  const total = totalWeight ?? 0;
  const ariaLabel = `${caption} ${rounded}％，已走 ${walked} / ${total}`;

  const dashStyle: CSSProperties = {
    strokeDasharray: CIRCUMFERENCE,
    strokeDashoffset: offset,
    transitionProperty: "stroke-dashoffset",
    transitionDuration: "500ms",
    transitionTimingFunction: "ease-out",
  };

  return (
    <figure className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={ariaLabel}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#E8E0D2"
            strokeWidth={STROKE}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="#3F6F5B"
            strokeWidth={STROKE}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={dashStyle}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-[32px] font-semibold leading-none tracking-tight text-ink">
            {rounded}%
          </span>
        </div>
      </div>
      <figcaption className="text-center">
        <p className="text-lg font-medium text-ink">{caption}</p>
        <p className="mt-1 text-lg text-ink/55">
          已走 {walked} / {total}
        </p>
      </figcaption>
    </figure>
  );
}
