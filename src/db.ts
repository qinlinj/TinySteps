// src/db.ts
// Dexie IndexedDB: settings, goals, messages. CRUD + JSON export.

import Dexie, { type Table } from 'dexie';
import {
  DEFAULT_SETTINGS,
  EMPTY_APP_STATE,
  type AppSettings,
  type AppState,
  type ChatMessage,
  type Goal,
} from './types';
import { applyProgress } from './lib/progress';

export const SETTINGS_ROW_ID = 'app' as const;

export interface SettingsRow {
  id: typeof SETTINGS_ROW_ID;
  apiKey: string | null;
  activeGoalId: string | null;
  preferredModel: string;
  language: AppSettings['language'];
}

const defaultSettingsRow = (): SettingsRow => ({
  id: SETTINGS_ROW_ID,
  apiKey: null,
  activeGoalId: null,
  preferredModel: DEFAULT_SETTINGS.preferredModel,
  language: DEFAULT_SETTINGS.language,
});

export class TinyStepsDB extends Dexie {
  settings!: Table<SettingsRow, string>;
  goals!: Table<Goal, string>;
  messages!: Table<ChatMessage, string>;

  constructor() {
    super('TinySteps');
    this.version(1).stores({
      settings: 'id',
      goals: 'id, type, createdAt, currentMood',
      messages: 'id, relatedGoalId, timestamp, role',
    });
  }
}

export const db = new TinyStepsDB();

function rowToSettings(row: SettingsRow): AppSettings {
  return {
    preferredModel: row.preferredModel,
    language: row.language,
  };
}

export async function ensureSettings(): Promise<SettingsRow> {
  const existing = await db.settings.get(SETTINGS_ROW_ID);
  if (existing) return existing;
  const row = defaultSettingsRow();
  await db.settings.put(row);
  return row;
}

export async function getSettings(): Promise<SettingsRow> {
  return ensureSettings();
}

export async function saveSettings(
  patch: Partial<Omit<SettingsRow, 'id'>>,
): Promise<SettingsRow> {
  const current = await ensureSettings();
  const next: SettingsRow = { ...current, ...patch, id: SETTINGS_ROW_ID };
  await db.settings.put(next);
  return next;
}

export async function setApiKey(apiKey: string | null): Promise<SettingsRow> {
  const trimmed = apiKey?.trim() ? apiKey.trim() : null;
  return saveSettings({ apiKey: trimmed });
}

export async function setActiveGoalId(
  activeGoalId: string | null,
): Promise<SettingsRow> {
  return saveSettings({ activeGoalId });
}

export async function listGoals(): Promise<Goal[]> {
  const goals = await db.goals.toArray();
  return goals.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  return db.goals.get(id);
}

export async function putGoal(goal: Goal): Promise<Goal> {
  const next = applyProgress(goal);
  await db.goals.put(next);
  return next;
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.messages, db.settings, async () => {
    await db.goals.delete(id);
    await db.messages.where('relatedGoalId').equals(id).delete();
    const settings = await ensureSettings();
    if (settings.activeGoalId === id) {
      await db.settings.put({ ...settings, activeGoalId: null });
    }
  });
}

export async function listMessages(relatedGoalId?: string): Promise<ChatMessage[]> {
  const rows = relatedGoalId
    ? await db.messages.where('relatedGoalId').equals(relatedGoalId).toArray()
    : await db.messages.toArray();
  return rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function addMessage(message: ChatMessage): Promise<ChatMessage> {
  await db.messages.put(message);
  return message;
}

export async function deleteMessage(id: string): Promise<void> {
  await db.messages.delete(id);
}

export async function clearMessages(): Promise<void> {
  await db.messages.clear();
}

export async function loadAppState(): Promise<AppState> {
  const [settings, goals, chatHistory] = await Promise.all([
    ensureSettings(),
    listGoals(),
    listMessages(),
  ]);

  return {
    apiKey: settings.apiKey,
    goals,
    activeGoalId: settings.activeGoalId,
    chatHistory,
    settings: rowToSettings(settings),
  };
}

export async function persistAppState(state: AppState): Promise<void> {
  await db.transaction('rw', db.settings, db.goals, db.messages, async () => {
    await db.settings.put({
      id: SETTINGS_ROW_ID,
      apiKey: state.apiKey,
      activeGoalId: state.activeGoalId,
      preferredModel: state.settings.preferredModel,
      language: state.settings.language,
    });
    await db.goals.clear();
    if (state.goals.length > 0) {
      await db.goals.bulkPut(state.goals.map(applyProgress));
    }
    await db.messages.clear();
    if (state.chatHistory.length > 0) {
      await db.messages.bulkPut(state.chatHistory);
    }
  });
}

/** Full AppState JSON for the export button. */
export async function exportAppJson(): Promise<string> {
  const state = await loadAppState();
  return JSON.stringify(state, null, 2);
}

export async function importAppJson(json: string): Promise<AppState> {
  const parsed = JSON.parse(json) as Partial<AppState>;
  const state: AppState = {
    apiKey: parsed.apiKey ?? null,
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    activeGoalId: parsed.activeGoalId ?? null,
    chatHistory: Array.isArray(parsed.chatHistory) ? parsed.chatHistory : [],
    settings: {
      preferredModel: parsed.settings?.preferredModel ?? DEFAULT_SETTINGS.preferredModel,
      language: parsed.settings?.language === 'en' ? 'en' : 'zh',
    },
  };
  await persistAppState(state);
  return loadAppState();
}

export async function resetAppData(keepApiKey = true): Promise<AppState> {
  const current = keepApiKey ? await ensureSettings() : null;
  await persistAppState({
    ...EMPTY_APP_STATE,
    apiKey: current?.apiKey ?? null,
    settings: current
      ? { preferredModel: current.preferredModel, language: current.language }
      : DEFAULT_SETTINGS,
  });
  return loadAppState();
}
