/**
 * Chinese chat intent detector for TinySteps Sprint 1.
 * Pure functions. No React. No store imports.
 *
 * Precedence (first match wins among the specific group, then stuck, then mood):
 *   replan > extra-done > add-task > stuck > mood-shift > none
 *
 * Why not "stuck > add-task"? Bare 「帮我」 is stuck, but 「帮我加一个任务」
 * must be add-task. Scan task-mutation / replan cues first; treat 「帮我」 as
 * stuck only when no replan / extra-done / add-task cue also matches.
 *
 * detectMoodSignal is orthogonal: it may fire on the same utterance as stuck
 * or replan. The store must NEVER apply a mood tag until the user confirms.
 *
 * Self-check examples (input → kind):
 *   "我卡住了"                  → stuck (high; strong phrase)
 *   "帮我"                      → stuck (medium)
 *   "帮我加一个任务"            → add-task (not stuck)
 *   "重新规划"                  → replan (high; strong phrase)
 *   "今天换一组"                → replan
 *   "调整计划"                  → replan
 *   "额外做了洗碗"              → extra-done, payload.taskTitle ≈ "洗碗"
 *   "顺便做了整理邮箱"          → extra-done
 *   "再加一个买菜"              → add-task, payload.taskTitle ≈ "买菜"
 *   "还想做拉伸"                → add-task
 *   "做完了" / "我完成了"       → none (bare complete is a UI click, not extra-done)
 *   "好累，不想做"              → mood-shift, suggestedMood negative
 *   "卡住了，好累"              → stuck; detectMoodSignal → negative
 *   "救命" / "睡着了"           → stuck
 *   "不在清单里但做了回邮件"    → extra-done
 */

export type ChatIntentKind =
  | 'stuck'
  | 'replan'
  | 'extra-done'
  | 'add-task'
  | 'mood-shift'
  | 'none';

export type IntentConfidence = 'high' | 'medium' | 'low';

export type MoodState = 'positive' | 'neutral' | 'negative';

export interface DetectedIntent {
  kind: ChatIntentKind;
  confidence: IntentConfidence;
  matched: string[];
  payload?: {
    taskTitle?: string;
    suggestedMood?: MoodState;
  };
}

export interface MoodSignal {
  suggestedMood: Exclude<MoodState, 'neutral'>;
  matched: string[];
}

/**
 * Cue lists for tests and the detector.
 * `strong` phrases are subsets of `cues` and force high confidence alone.
 * `weak` mood words force low confidence when they are the only mood hit
 * and mood-shift is the primary kind.
 */
export const INTENT_CUES = {
  stuck: [
    '卡住了',
    '卡住',
    '不知道怎么开始',
    '不知道从哪里开始',
    '不知道怎么办',
    '进行不下去',
    '推不动',
    '无从下手',
    '太难了',
    '做不动',
    '没办法开始',
    '帮帮我',
    '帮我',
    '救命',
    '睡着了',
    '走不动',
    '迈不出第一步',
    '脑子转不动',
    '启动不了',
  ],
  stuckStrong: [
    '卡住了',
    '不知道怎么开始',
    '不知道从哪里开始',
    '不知道怎么办',
    '无从下手',
    '进行不下去',
    '没办法开始',
  ],
  replan: [
    '重新规划',
    '重新安排',
    '重新拆',
    '重新排今天',
    '今天换一组',
    '今天重来',
    '换一批',
    '重排',
    '调整计划',
    '计划改一下',
    '改一下计划',
    '重做今天的清单',
    '今天的任务换掉',
    '换一组今天的',
  ],
  replanStrong: ['重新规划', '重新安排', '重新排今天', '今天换一组', '调整计划'],
  extraDone: [
    '不在清单里但做了',
    '额外走了一步',
    '超额完成',
    '额外完成',
    '还多做了',
    '额外做了',
    '多完成了',
    '多做完了',
    '顺便做了',
    '多做了',
    '计划外做了',
    '额外多做',
    '清单外做了',
  ],
  extraDoneStrong: ['不在清单里但做了', '超额完成', '额外完成', '额外走了一步'],
  addTask: [
    '帮我加一个',
    '帮我加个',
    '再加一个',
    '加个任务',
    '加进清单',
    '加到今天',
    '还有一件事',
    '加一件',
    '加一步',
    '补一条',
    '还想做',
    '加一个',
    '加一项',
    '再加一件',
    '添一个任务',
    '清单再加',
  ],
  addTaskStrong: ['再加一个', '加个任务', '帮我加一个', '加到今天', '还有一件事'],
  moodNegative: [
    '心情很差',
    '心情不好',
    '累坏了',
    '压力大',
    '不想做',
    '心烦',
    '焦虑',
    '悲伤',
    '难受',
    '折腾',
    '崩了',
    '烦',
    '累',
    '糟',
  ],
  moodNegativeStrong: ['心情很差', '心情不好', '累坏了', '压力大', '不想做'],
  moodNegativeWeak: ['累', '烦', '糟', '折腾', '崩了'],
  moodPositive: [
    '做完挺高兴',
    '状态不错',
    '能量还在',
    '有动力',
    '感觉好',
    '很顺',
    '有劲',
    '顺利',
    '不错',
    '开心',
  ],
  moodPositiveStrong: ['做完挺高兴', '状态不错', '能量还在', '有动力', '感觉好'],
  moodPositiveWeak: ['不错', '顺利', '开心', '有劲', '很顺'],
} as const;

const TITLE_STOP = new Set([
  '任务',
  '一步',
  '一件',
  '一条',
  '一下',
  '一项',
  '今天',
  '清单',
  '一个',
  '这个',
  '那个',
  '事情',
  '事',
]);

const LEADING_TITLE_JUNK =
  /^(?:[：:，,。.!\uff01?\uff1f、\-\u2014\uff5e~]|了|的|是|把|一下|一个|一项|一条|一步|一件)+/;

const TRAILING_TITLE_JUNK = /[。.!\uff01?\uff1f，,、；;]+$/;

/** Full-width / CJK punctuation stripped for cue matching only. */
const MATCH_PUNCT =
  /[\s\u3000\uff01\uff1f\u3002\uff0c\u3001\uff1b\uff1a""''\u300c\u300d\u300e\u300f\uff08\uff09\u3010\u3011\u300a\u300b\u3008\u3009\u2026\u2014\uff5e\xb7,.!?;:'"()[\]<>{}]/g;

export function normalizeChatText(text: string): string {
  return text.normalize('NFKC').replace(MATCH_PUNCT, '');
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function findHits(normalized: string, cues: readonly string[]): string[] {
  if (!normalized) return [];
  const sorted = [...cues].sort((a, b) => b.length - a.length);
  const hits: string[] = [];
  for (const cue of sorted) {
    if (cue && normalized.includes(cue)) hits.push(cue);
  }
  return hits;
}

/** Count cues after dropping those that are strict substrings of a longer hit. */
function distinctCueCount(hits: readonly string[]): number {
  return hits.filter(
    (cue) => !hits.some((other) => other !== cue && other.includes(cue)),
  ).length;
}

function hasStrong(hits: readonly string[], strong: readonly string[]): boolean {
  return hits.some((hit) => (strong as readonly string[]).includes(hit));
}

function confidenceFor(
  hits: readonly string[],
  strong: readonly string[],
): IntentConfidence {
  if (hasStrong(hits, strong) || distinctCueCount(hits) >= 2) return 'high';
  if (hits.length >= 1) return 'medium';
  return 'low';
}

function moodConfidence(hits: readonly string[], side: 'positive' | 'negative'): IntentConfidence {
  const strong =
    side === 'negative' ? INTENT_CUES.moodNegativeStrong : INTENT_CUES.moodPositiveStrong;
  const weak = side === 'negative' ? INTENT_CUES.moodNegativeWeak : INTENT_CUES.moodPositiveWeak;
  if (hasStrong(hits, strong) || distinctCueCount(hits) >= 2) return 'high';
  const onlyWeak =
    hits.length > 0 && hits.every((hit) => (weak as readonly string[]).includes(hit));
  if (onlyWeak && distinctCueCount(hits) === 1) return 'low';
  if (hits.length >= 1) return 'medium';
  return 'low';
}

function cleanExtractedTitle(raw: string): string | undefined {
  let title = raw.trim().replace(/\s+/g, ' ');
  title = title.replace(LEADING_TITLE_JUNK, '').replace(TRAILING_TITLE_JUNK, '').trim();
  title = title.replace(/^[\u300c\u300e\u201c"']+|[\u300d\u300f\u201d"']+$/g, '').trim();
  if (!title) return undefined;
  if (title.length > 24) title = title.slice(0, 24).trim();
  if (TITLE_STOP.has(title)) return undefined;
  // Reject leftover that is itself only another cue.
  const allCues = [
    ...INTENT_CUES.stuck,
    ...INTENT_CUES.replan,
    ...INTENT_CUES.extraDone,
    ...INTENT_CUES.addTask,
  ];
  if (allCues.includes(title as (typeof allCues)[number])) return undefined;
  return title || undefined;
}

/**
 * Pull a short title after the rightmost extra-done / add-task cue.
 * Returns undefined when the user did not name the step.
 */
export function extractTaskTitle(
  text: string,
  kind: 'extra-done' | 'add-task',
): string | undefined {
  const collapsed = text.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!collapsed) return undefined;
  const cues = kind === 'extra-done' ? INTENT_CUES.extraDone : INTENT_CUES.addTask;
  const sorted = [...cues].sort((a, b) => b.length - a.length);
  let bestIndex = -1;
  let bestCue = '';
  for (const cue of sorted) {
    const index = collapsed.indexOf(cue);
    if (index === -1) continue;
    const end = index + cue.length;
    if (end > bestIndex || (end === bestIndex && cue.length > bestCue.length)) {
      bestIndex = end;
      bestCue = cue;
    }
  }
  if (bestIndex < 0) return undefined;
  return cleanExtractedTitle(collapsed.slice(bestIndex));
}

/**
 * Orthogonal mood sidecar. Does not decide the primary intent.
 * If both poles match, the side with more distinct cues wins; ties go negative
 * so the today list shrinks rather than grows.
 */
export function detectMoodSignal(text: string): MoodSignal | null {
  const normalized = normalizeChatText(text);
  if (!normalized) return null;
  const negative = findHits(normalized, INTENT_CUES.moodNegative);
  const positive = findHits(normalized, INTENT_CUES.moodPositive);
  if (negative.length === 0 && positive.length === 0) return null;
  const negScore = distinctCueCount(negative);
  const posScore = distinctCueCount(positive);
  if (negScore > posScore || (negScore === posScore && negative.length >= positive.length)) {
    return { suggestedMood: 'negative', matched: unique(negative) };
  }
  return { suggestedMood: 'positive', matched: unique(positive) };
}

function withPayload(
  kind: 'extra-done' | 'add-task',
  text: string,
  hits: string[],
  strong: readonly string[],
): DetectedIntent {
  const taskTitle = extractTaskTitle(text, kind);
  return {
    kind,
    confidence: confidenceFor(hits, strong),
    matched: unique(hits),
    payload: taskTitle ? { taskTitle } : undefined,
  };
}

export function detectChatIntent(text: string): DetectedIntent {
  const normalized = normalizeChatText(text);
  if (!normalized) {
    return { kind: 'none', confidence: 'low', matched: [] };
  }

  const replanHits = findHits(normalized, INTENT_CUES.replan);
  const extraHits = findHits(normalized, INTENT_CUES.extraDone);
  const addHits = findHits(normalized, INTENT_CUES.addTask);
  const stuckHits = findHits(normalized, INTENT_CUES.stuck);
  const mood = detectMoodSignal(text);

  // Specific task-mutation / replan intents beat bare 「帮我」 stuck.
  if (replanHits.length > 0) {
    return {
      kind: 'replan',
      confidence: confidenceFor(replanHits, INTENT_CUES.replanStrong),
      matched: unique(replanHits),
    };
  }
  if (extraHits.length > 0) {
    return withPayload('extra-done', text, extraHits, INTENT_CUES.extraDoneStrong);
  }
  if (addHits.length > 0) {
    return withPayload('add-task', text, addHits, INTENT_CUES.addTaskStrong);
  }
  if (stuckHits.length > 0) {
    return {
      kind: 'stuck',
      confidence: confidenceFor(stuckHits, INTENT_CUES.stuckStrong),
      matched: unique(stuckHits),
    };
  }
  if (mood) {
    return {
      kind: 'mood-shift',
      confidence: moodConfidence(mood.matched, mood.suggestedMood),
      matched: mood.matched,
      payload: { suggestedMood: mood.suggestedMood },
    };
  }
  return { kind: 'none', confidence: 'low', matched: [] };
}


/** Compatibility wrappers for the current Zustand store. */
export type UserIntent = 'stuck' | 'replan' | 'extra_done' | 'add_task' | 'chat';

export function detectIntent(text: string): UserIntent {
  const detected = detectChatIntent(text);
  if (detected.kind === 'extra-done') return 'extra_done';
  if (detected.kind === 'add-task') return 'add_task';
  if (detected.kind === 'stuck' || detected.kind === 'replan') return detected.kind;
  return 'chat';
}

export function extractExtraTitle(text: string): string {
  return extractTaskTitle(text, 'extra-done') ?? text.trim();
}

export function extractNewTaskTitle(text: string): string {
  return extractTaskTitle(text, 'add-task') ?? text.trim();
}

export function looksLikeMoodSignal(text: string): boolean {
  return detectMoodSignal(text) !== null;
}
