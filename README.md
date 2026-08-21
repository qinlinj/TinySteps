# TinySteps

Local-first, mood-aware mentor for taking one tiny step at a time.
The UI is Simplified Chinese. Comments and this README are English.

Your xAI API key never leaves the browser. Goals, tasks, chat, and the key
live in IndexedDB (Dexie) on this device.

## Run locally

```bash
npm i
npm run dev
```

Open the printed URL (Vite listens on 0.0.0.0:5173).
Paste your own xAI API key on the first screen, then create a habit or a project.

## Scripts

Dev server: Vite, host true, port 5173.
Build: TypeScript project build then Vite production bundle in dist.
Preview: serve the dist folder.
Lint: Oxlint.

## Deploy as a static site

Vite SPA. Publish the dist folder. Enable SPA fallback so all routes serve index.html.

Vercel: Vite preset, output dist.
Netlify: build then publish dist, plus a catch-all to index.html.
Cloudflare Pages: same, output dist, SPA fallback.

No backend and no host-side secrets. Each visitor pastes their own xAI key. It stays in that browser.

## How it feels

No key: paste key.
No goals: create a habit or a project. Vague projects may ask a few short questions first.
Then: progress ring, mood tag, today 1-3 tiny tasks, and chat.
Mark a task done: the ring updates and Dexie persists. Refresh keeps the data.
Chat: stuck opens guided A/B/C; also replan, extra done, add a task, and mood ask-then-confirm.

## Privacy

The key is sent only from the browser to the xAI chat completions API.
Export local data any time from the in-app export button.
