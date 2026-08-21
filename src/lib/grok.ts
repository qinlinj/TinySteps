// src/lib/grok.ts
// Frontend-only xAI chat wrapper. The user's key never leaves the browser.

export const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
export const DEFAULT_GROK_MODEL = 'grok-4';

export type GrokRole = 'system' | 'user' | 'assistant';

export interface GrokMessage {
  role: GrokRole;
  content: string;
}

export type GrokErrorCode =
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'empty'
  | 'parse'
  | 'http';

export class GrokError extends Error {
  readonly code: GrokErrorCode;
  readonly status?: number;

  constructor(message: string, code: GrokErrorCode, status?: number) {
    super(message);
    this.name = 'GrokError';
    this.code = code;
    this.status = status;
  }
}

interface GrokChoice {
  message?: { content?: string | null };
}

interface GrokApiErrorBody {
  error?: { message?: string; type?: string; code?: string };
  message?: string;
}

function friendlyHttpError(status: number, hint: string): GrokError {
  if (status === 401 || status === 403) {
    return new GrokError(
      'API Key 好像无效或已过期。到设置里重新贴一次就好，不着急。',
      'auth',
      status,
    );
  }
  if (status === 429) {
    return new GrokError(
      '这一会儿请求有点密。歇一口气再试，任务还在，哪儿也不去。',
      'rate_limit',
      status,
    );
  }
  if (status === 402 || /quota|billing|credit|balance/i.test(hint)) {
    return new GrokError(
      '这个 Key 的额度好像用完了。换一个有余额的 Key，或稍后再来。',
      'quota',
      status,
    );
  }
  return new GrokError(
    '模型这边暂时没回上。过一会儿再试一次就好。',
    'http',
    status,
  );
}

function readErrorHint(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const body = payload as GrokApiErrorBody;
  const parts = [body.error?.message, body.error?.type, body.error?.code, body.message];
  return parts.filter((part): part is string => typeof part === 'string').join(' ');
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 240) };
  }
}

export async function callGrok(
  messages: GrokMessage[],
  apiKey: string,
  model = DEFAULT_GROK_MODEL,
): Promise<unknown> {
  const key = apiKey.trim();
  if (!key) {
    throw new GrokError(
      '还没有填 API Key。在设置里贴上你自己的 xAI Key，我们就能开始。',
      'auth',
    );
  }
  if (!messages.length) {
    throw new GrokError('这次没有话要送给模型。稍后再试一次。', 'empty');
  }

  let res: Response;
  try {
    res = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    throw new GrokError(
      '网络好像断了一下。检查一下连接，连上了再轻轻点一次。',
      'network',
    );
  }

  const payload = await readJsonSafe(res);
  if (!res.ok) {
    throw friendlyHttpError(res.status, readErrorHint(payload));
  }

  const record = payload && typeof payload === 'object' ? (payload as { choices?: GrokChoice[] }) : null;
  const content = record?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new GrokError('模型这次没有说出完整的话。再试一次就好。', 'empty', res.status);
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    const stripped = content
      .replace(/^\s*```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(stripped) as unknown;
    } catch {
      throw new GrokError('模型回了内容，但格式有点乱。再试一次通常就好。', 'parse', res.status);
    }
  }
}
