import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, GuidedOption } from "../types";
import { GuidedChoices } from "./GuidedChoices";

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  choices?: GuidedOption[];
  onChoose?: (id: string) => void;
  disabled?: boolean;
}

const CHIPS = ["我卡住了", "换一个更小的"] as const;

export function ChatPanel({
  messages,
  onSend,
  choices,
  onChoose,
  disabled,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, choices?.length]);

  function submit(text: string) {
    const next = text.trim();
    if (!next || disabled) return;
    onSend(next);
    setDraft("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(draft);
  }

  const canSend = !disabled && draft.trim().length > 0;

  return (
    <section className="flex h-full min-h-[28rem] flex-col rounded-3xl bg-white/70 shadow-card ring-1 ring-stone-deep/60">
      <header className="border-b border-stone-deep/50 px-6 py-5">
        <h2 className="text-xl font-semibold tracking-tight text-ink">轻轻说一句</h2>
        <p className="mt-1 text-lg leading-relaxed text-ink/55">想说什么都可以，不用完美。</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <p className="text-lg leading-relaxed text-ink/45">还没有对话。想说什么都可以。</p>
        )}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-[92%] rounded-3xl px-5 py-3 text-lg leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-sage text-paper"
                : "bg-paper text-ink ring-1 ring-stone-deep/50"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}

        {choices && choices.length > 0 && (
          <GuidedChoices options={choices} onSelect={(id) => onChoose?.(id)} disabled={disabled} />
        )}

        <div ref={endRef} />
      </div>

      <div className="border-t border-stone-deep/50 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled}
              onClick={() => submit(chip)}
              className="min-h-12 rounded-full bg-paper px-5 text-lg text-ink/70 ring-1 ring-stone-deep/70 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2">
          <label className="sr-only" htmlFor="tinysteps-chat-input">
            想说什么都可以
          </label>
          <input
            id="tinysteps-chat-input"
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="想说什么都可以"
            className="min-h-12 flex-1 rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="min-h-12 min-w-[5.5rem] rounded-3xl bg-sage px-5 text-lg font-medium text-paper transition hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        </form>
      </div>
    </section>
  );
}
