// BotBot API client - typed fetch wrappers for all backend endpoints
import { getPosApiBaseUrl } from './posBackendApi';

// ── types ──────────────────────────────────────────────────────────

export type BotBotModel = {
  modelKey: string;
  displayName: string;
  provider: string;
  freeTokenQuota: number;
  enabled?: boolean;
  sortOrder?: number;
  allowed?: boolean;
  tokenQuota?: number;
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

export type BotBotUsagePoint = {
  bucket: string;
  events: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  errors: number;
  denied: number;
  slowResponses: number;
};

export type BotBotSkillUsageRow = {
  skillKey: string;
  label: string;
  events: number;
  totalTokens: number;
  denied: number;
  errors: number;
};

export type BotBotAccessModel = {
  modelKey: string;
  displayName: string;
  provider: string;
  enabled: boolean;
  sortOrder: number;
  allowed: boolean;
  hasOverride: boolean;
  tokenQuota: number;
};

export type BotBotAccessSkill = {
  skillKey: string;
  label: string;
  description: string;
  defaultAllowed: boolean;
  adminOnly: boolean;
  allowed: boolean;
  hasOverride: boolean;
};

export type BotBotAccessState = {
  subject: { type: 'role' | 'user'; key: string };
  models: BotBotAccessModel[];
  skills: BotBotAccessSkill[];
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
  endpointKey?: string;
  endpointLabel?: string;
  endpointUrl?: string;
  defaultNodeKey: string;
  preferredNodeKey: string;
  primaryNodeLabel: string;
  primaryModel: string;
  reachable?: boolean;
  models?: string[];
  modelCount?: number;
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
  pageId?: string;
  subPageId?: string;
  dateRange?: {
    start: string;
    end: string;
    label?: string;
    compareStart?: string;
    compareEnd?: string;
    compareLabel?: string;
  };
  filters?: Record<string, string | null | undefined>;
  visibleSections?: string[];
  dataWarnings?: string[];
  selectedSort?: string;
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

const mapModel = (raw: any): BotBotModel => ({
  modelKey: String(raw.modelKey ?? raw.model_key ?? ''),
  displayName: String(raw.displayName ?? raw.display_name ?? raw.modelKey ?? raw.model_key ?? ''),
  provider: String(raw.provider ?? ''),
  freeTokenQuota: Number(raw.freeTokenQuota ?? raw.free_token_quota ?? raw.tokenQuota ?? raw.token_quota ?? 0),
  enabled: raw.enabled === undefined ? undefined : Boolean(raw.enabled),
  sortOrder: raw.sortOrder === undefined && raw.sort_order === undefined ? undefined : Number(raw.sortOrder ?? raw.sort_order ?? 0),
  allowed: raw.allowed === undefined ? undefined : Boolean(raw.allowed),
  tokenQuota: raw.tokenQuota === undefined && raw.token_quota === undefined ? undefined : Number(raw.tokenQuota ?? raw.token_quota ?? 0),
});

const mapAccess = (raw: any): BotBotAccessState => ({
  subject: {
    type: raw?.subject?.type === 'user' ? 'user' : 'role',
    key: String(raw?.subject?.key ?? ''),
  },
  models: Array.isArray(raw?.models)
    ? raw.models.map((model: any) => ({
        modelKey: String(model.modelKey ?? model.model_key ?? ''),
        displayName: String(model.displayName ?? model.display_name ?? ''),
        provider: String(model.provider ?? ''),
        enabled: Boolean(model.enabled),
        sortOrder: Number(model.sortOrder ?? model.sort_order ?? 0),
        allowed: Boolean(model.allowed),
        hasOverride: Boolean(model.hasOverride ?? model.has_override),
        tokenQuota: Number(model.tokenQuota ?? model.token_quota ?? 0),
      }))
    : [],
  skills: Array.isArray(raw?.skills)
    ? raw.skills.map((skill: any) => ({
        skillKey: String(skill.skillKey ?? skill.skill_key ?? ''),
        label: String(skill.label ?? ''),
        description: String(skill.description ?? ''),
        defaultAllowed: Boolean(skill.defaultAllowed ?? skill.default_allowed),
        adminOnly: Boolean(skill.adminOnly ?? skill.admin_only),
        allowed: Boolean(skill.allowed),
        hasOverride: Boolean(skill.hasOverride ?? skill.has_override),
      }))
    : [],
});

// ── exports ────────────────────────────────────────────────────────

export const fetchBotBotModels = (): Promise<BotBotModel[]> =>
  fetchJson('/api/botbot/models').then(r => (Array.isArray(r.models) ? r.models.map(mapModel) : []));

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
    preferredRuntimeNode: String(raw.preferredRuntimeNode ?? raw.preferred_runtime_node ?? 'alphaai'),
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
    }),
  });

// Admin endpoints
export const fetchAdminUsage = (page = 1, limit = 50): Promise<{ rows: any[]; total: number }> =>
  fetchJson(`/api/botbot/admin/usage?page=${page}&limit=${limit}`);

export const fetchAdminModelConfig = (): Promise<BotBotModel[]> =>
  fetchJson('/api/botbot/admin/model-config').then(r => (Array.isArray(r.models) ? r.models.map(mapModel) : []));

export const fetchAdminUsageHistory = (range = '1h'): Promise<{ range: string; bucketSeconds: number; points: BotBotUsagePoint[] }> =>
  fetchJson(`/api/botbot/admin/usage/history?range=${encodeURIComponent(range)}`).then(r => ({
    range: String(r.range ?? range),
    bucketSeconds: Number(r.bucketSeconds ?? r.bucket_seconds ?? 60),
    points: Array.isArray(r.points) ? r.points.map((p: any) => ({
      bucket: String(p.bucket ?? ''),
      events: Number(p.events ?? 0),
      totalTokens: Number(p.totalTokens ?? p.total_tokens ?? 0),
      inputTokens: Number(p.inputTokens ?? p.input_tokens ?? 0),
      outputTokens: Number(p.outputTokens ?? p.output_tokens ?? 0),
      estimatedCostUsd: Number(p.estimatedCostUsd ?? p.estimated_cost_usd ?? 0),
      errors: Number(p.errors ?? 0),
      denied: Number(p.denied ?? 0),
      slowResponses: Number(p.slowResponses ?? p.slow_responses ?? 0),
    })) : [],
  }));

export const fetchAdminUsageBySkill = (range = '24h'): Promise<BotBotSkillUsageRow[]> =>
  fetchJson(`/api/botbot/admin/usage/by-skill?range=${encodeURIComponent(range)}`).then(r =>
    Array.isArray(r.rows) ? r.rows.map((row: any) => ({
      skillKey: String(row.skillKey ?? row.skill_key ?? ''),
      label: String(row.label ?? ''),
      events: Number(row.events ?? 0),
      totalTokens: Number(row.totalTokens ?? row.total_tokens ?? 0),
      denied: Number(row.denied ?? 0),
      errors: Number(row.errors ?? 0),
    })) : []
  );

export const fetchRoleAccess = (roleKey: string): Promise<BotBotAccessState> =>
  fetchJson(`/api/botbot/admin/access/roles/${encodeURIComponent(roleKey)}`).then(mapAccess);

export const patchRoleAccess = (roleKey: string, patch: any): Promise<BotBotAccessState> =>
  fetchJson(`/api/botbot/admin/access/roles/${encodeURIComponent(roleKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(r => mapAccess(r.access ?? r));

export const fetchUserAccess = (userId: number | string): Promise<BotBotAccessState> =>
  fetchJson(`/api/botbot/admin/access/users/${encodeURIComponent(String(userId))}`).then(mapAccess);

export const patchUserAccess = (userId: number | string, patch: any): Promise<BotBotAccessState> =>
  fetchJson(`/api/botbot/admin/access/users/${encodeURIComponent(String(userId))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(r => mapAccess(r.access ?? r));

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
