// BotBot API client - typed fetch wrappers for all backend endpoints
import { getPosApiBaseUrl } from './posBackendApi';

// ── types ──────────────────────────────────────────────────────────

export type BotBotModel = {
  modelKey: string;
  displayName: string;
  provider: string;
  freeTokenQuota: number;
};

export type BotBotConversation = {
  id: number;
  title: string;
  modelKey: string;
  contextTag: string;
  updatedAt: string;
  messageCount: number;
};

export type BotBotMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  modelKey: string;
  inputTokens: number;
  outputTokens: number;
  finishReason: string | null;
  createdAt: string;
};

export type TokenUsageRow = {
  modelKey: string;
  displayName: string;
  tokensUsed: number;
  quota: number;
  quotaRemaining: number;
  pctUsed: number;
};

export type BotBotSettings = {
  assistantName: string;
  assistantTheme: string;
  tutorialCompleted: boolean;
  preferredModelKey: string;
  preferredRuntimeNode: string;
};

export type BotBotRuntimeNode = {
  key: string;
  label: string;
  host: string;
  baseUrl: string;
  description: string;
  reachable: boolean;
  models: string[];
  modelCount: number;
  isDefault: boolean;
  isSelected: boolean;
};

export type BotBotRuntimeStatus = {
  enabled: boolean;
  defaultNodeKey: string;
  preferredNodeKey: string;
  primaryNodeLabel: string;
  primaryModel: string;
  nodes: BotBotRuntimeNode[];
};

export type SendMessageResult = {
  message: BotBotMessage;
  tokensUsed: number;
  quota: number;
  quotaRemaining: number;
  error?: string;
};

export type PageContext = {
  pageName: string;
  module: string;
  userRole: string;
  keyMetricsVisible: string[];
  suggestedActions: string[];
};

// ── helpers ────────────────────────────────────────────────────────

async function fetchJson(path: string, init?: RequestInit): Promise<any> {
  const base = getPosApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(`BotBot API ${res.status} for ${path}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

async function postJson(path: string, body: any): Promise<any> {
  return fetchJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── exports ────────────────────────────────────────────────────────

export const fetchBotBotModels = (): Promise<BotBotModel[]> =>
  fetchJson('/api/botbot/models').then(r => r.models);

export const fetchConversations = (): Promise<BotBotConversation[]> =>
  fetchJson('/api/botbot/conversations').then(r => r.conversations);

export const createConversation = (
  modelKey: string,
  title?: string,
  contextTag?: string
): Promise<BotBotConversation> =>
  postJson('/api/botbot/conversations', { modelKey, title, contextTag }).then(r => r.conversation);

export const updateConversationTitle = (id: number, title: string): Promise<void> =>
  fetchJson(`/api/botbot/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });

export const deleteConversation = (id: number): Promise<void> =>
  fetchJson(`/api/botbot/conversations/${id}`, { method: 'DELETE' });

export const fetchMessages = (conversationId: number): Promise<BotBotMessage[]> =>
  fetchJson(`/api/botbot/conversations/${conversationId}/messages`).then(r => r.messages);

export async function sendMessage(
  conversationId: number,
  content: string,
  pageContext?: PageContext
): Promise<SendMessageResult> {
  return postJson(`/api/botbot/conversations/${conversationId}/messages`, {
    content,
    pageContext,
  });
}

export const fetchTokenUsage = (): Promise<TokenUsageRow[]> =>
  fetchJson('/api/botbot/token-usage').then(r => r.usage);

const mapSettings = (raw: any): BotBotSettings | null => {
  if (!raw) return null;
  return {
    assistantName: String(raw.assistantName ?? raw.assistant_name ?? 'BotBot'),
    assistantTheme: String(raw.assistantTheme ?? raw.assistant_theme ?? 'sky'),
    tutorialCompleted: Boolean(raw.tutorialCompleted ?? raw.tutorial_completed),
    preferredModelKey: String(raw.preferredModelKey ?? raw.preferred_model_key ?? 'local'),
    preferredRuntimeNode: String(raw.preferredRuntimeNode ?? raw.preferred_runtime_node ?? 'msi'),
  };
};

export const fetchSettings = (): Promise<BotBotSettings | null> =>
  fetchJson('/api/botbot/settings').then(r => mapSettings(r.settings));

export const fetchRuntimeStatus = (): Promise<BotBotRuntimeStatus> =>
  fetchJson('/api/botbot/runtime').then(r => r.runtime);

export const saveSettings = (settings: Partial<BotBotSettings>): Promise<void> =>
  fetchJson('/api/botbot/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assistantName: settings.assistantName,
      assistantTheme: settings.assistantTheme,
      tutorialCompleted: settings.tutorialCompleted,
      preferredModelKey: settings.preferredModelKey,
      preferredRuntimeNode: settings.preferredRuntimeNode,
    }),
  });

// Admin endpoints
export const fetchAdminUsage = (page = 1, limit = 50): Promise<{ rows: any[]; total: number }> =>
  fetchJson(`/api/botbot/admin/usage?page=${page}&limit=${limit}`);

export const fetchAdminModelConfig = (): Promise<BotBotModel[]> =>
  fetchJson('/api/botbot/admin/model-config').then(r => r.models);

export const patchAdminModelConfig = (
  modelKey: string,
  patch: { freeTokenQuota?: number; displayName?: string; enabled?: boolean; sortOrder?: number }
): Promise<any> =>
  fetchJson(`/api/botbot/admin/model-config/${encodeURIComponent(modelKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });

export const resetUserQuota = (userId: number, modelKey: string): Promise<void> =>
  postJson('/api/botbot/admin/reset-user-quota', { userId, modelKey });
