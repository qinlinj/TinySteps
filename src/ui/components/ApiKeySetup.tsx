import { useState, type FormEvent } from "react";

export interface ApiKeySetupProps {
  initialValue?: string;
  onSave: (key: string) => void;
}

export function ApiKeySetup({ initialValue = "", onSave }: ApiKeySetupProps) {
  const [key, setKey] = useState(initialValue);
  const trimmed = key.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-6 py-16 text-ink">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xl flex-col gap-8"
      >
        <header className="text-center">
          <p className="text-lg font-medium text-sage">小步 TinySteps</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">先放好你的钥匙</h1>
          <p className="mt-4 text-lg leading-relaxed text-ink/65">
            钥匙只会留在这台设备上，用来和 xAI 对话，不会被上传到任何服务器。
          </p>
        </header>

        <div className="flex flex-col gap-6 rounded-3xl bg-white/80 p-8 shadow-card ring-1 ring-stone-deep/60">
          <label className="block">
            <span className="text-lg font-medium text-ink">xAI API Key</span>
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="xAI API Key"
              className="mt-2 min-h-12 w-full rounded-3xl border border-stone-deep/80 bg-white px-4 text-lg text-ink"
            />
          </label>

          <button
            type="submit"
            disabled={trimmed.length === 0}
            className="min-h-12 rounded-3xl bg-sage text-lg font-medium text-paper transition hover:bg-sage-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            保存并继续
          </button>
        </div>

        <p className="text-center text-lg text-ink/50">以后也可以在设置里换掉。</p>
      </form>
    </main>
  );
}
