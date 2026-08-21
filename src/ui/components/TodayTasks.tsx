import type { TodayTask } from "../types";

export interface TodayTasksProps {
  tasks: TodayTask[];
  onComplete: (id: string) => void;
  onSkip?: (id: string) => void;
  emptyHint?: string;
}

function SoftCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-sage-deep">
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TodayTasks({
  tasks,
  onComplete,
  onSkip,
  emptyHint = "今天还没有小步。先呼吸一下也可以。",
}: TodayTasksProps) {
  const visible = tasks.slice(0, 3);

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold tracking-tight text-ink">今天这几步</h2>

      {visible.length === 0 ? (
        <p className="rounded-3xl bg-white/70 px-6 py-8 text-lg leading-relaxed text-ink/60 shadow-card ring-1 ring-stone-deep/60">
          {emptyHint}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((task) => {
            const done = task.status === "done";
            const skipped = task.status === "skipped";
            const pending = task.status === "pending";

            return (
              <li key={task.id}>
                <div
                  className={`flex items-stretch gap-2 rounded-3xl shadow-card ring-1 ${
                    done
                      ? "bg-sage-mist ring-sage/20"
                      : skipped
                        ? "bg-stone/70 ring-stone-deep/50"
                        : "bg-white ring-stone-deep/60"
                  }`}
                >
                  {pending ? (
                    <button
                      type="button"
                      onClick={() => onComplete(task.id)}
                      aria-label={`完成「${task.title}」`}
                      className="flex min-h-12 min-w-0 flex-1 items-start gap-4 rounded-3xl px-6 py-5 text-left"
                    >
                      <span aria-hidden className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-stone-deep bg-paper">
                        <span className="h-2.5 w-2.5 rounded-full bg-stone-deep" />
                      </span>
                      <TaskCopy task={task} muted={false} />
                    </button>
                  ) : (
                    <div
                      className="flex min-h-12 min-w-0 flex-1 items-start gap-4 rounded-3xl px-6 py-5"
                      aria-label={done ? `${task.title}，已完成` : `${task.title}，已跳过`}
                    >
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                          done ? "bg-white/80" : "border border-stone-deep bg-paper"
                        }`}
                      >
                        {done ? <SoftCheck /> : <span className="h-2.5 w-2.5 rounded-full bg-stone-deep" />}
                      </span>
                      <TaskCopy task={task} muted />
                    </div>
                  )}

                  {pending && onSkip && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSkip(task.id);
                      }}
                      aria-label={`跳过「${task.title}」`}
                      className="m-2 min-h-12 shrink-0 self-center rounded-3xl px-4 text-lg text-ink/40 hover:bg-stone hover:text-ink/70"
                    >
                      跳过
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TaskCopy({ task, muted }: { task: TodayTask; muted: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <span className={`block text-lg font-medium ${muted ? "text-ink/50" : "text-ink"}`}>
        {task.title}
      </span>
      {task.description && (
        <span className="mt-1 block text-lg leading-relaxed text-ink/55">{task.description}</span>
      )}
      <span className="mt-2 block text-lg text-ink/45">{task.estimatedMinutes} 分钟</span>
    </span>
  );
}
