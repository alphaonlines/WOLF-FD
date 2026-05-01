# BotBot Master Implementation Plan
### WOLF-FD Dashboard — Persistent AI Assistant with Token Paywall

---

## From the Lead Programmer's Desk

My name is **WOLF-1** for this engagement — I'm the lead developer overseeing the BotBot implementation from architecture through deployment. I've reviewed both the original `BOTBOT_TODO.md` and the token-paywall design that was drafted separately, and this document is the unified, authoritative plan that supersedes both.

Before anyone writes a single line of code, read this document in full. I mean all of it. Then read it again. I've seen too many projects get derailed because a junior dev skimmed a spec and made assumptions. That's not happening here.

### What I Expect From This Team

**Quality over speed.** I would rather you take an extra hour to do something right than spend three hours undoing a rushed implementation. If you're unsure about something, ask before you build it wrong.

**No magic.** Every function does one thing. Every file has a clear purpose. No 400-line route handlers. No components that do their own data fetching AND rendering AND business logic. Split it up.

**Test as you go.** You are responsible for verifying your own work before handing it off. If I review your PR and the basic happy path doesn't work, it goes back to you — no exceptions.

**Communicate blockers immediately.** If you're stuck for more than 30 minutes, say something. That's not a sign of weakness, that's professional. The only bad move is staying silent and missing a deadline.

**Respect the existing codebase.** This dashboard is in production serving real employees at a real furniture business. Do not touch files outside your assigned scope without checking with me or your shift partner first. The existing `WolfBot.tsx` (Dialogflow call routing) is OFF LIMITS — BotBot is a completely separate system.

**Commit messages matter.** Write them like someone has to read them in six months — because they will.

---

## Team Structure & Shift Roles

### Lead Programmer — WOLF-1
Responsible for overall architecture, code review, deployment sign-off, resolving blockers, and maintaining this document. I have final say on all design decisions. I am not a rubber stamp — bring me real questions, not ones you could answer yourself by reading the existing code.

**My responsibilities:**
- Approve all PRs before merge
- Maintain `routeWiring.ts`, `startupBootstrap.ts`, and `runtimeConfig.ts` — no one touches these without my review
- Resolve any cross-team conflicts (e.g. two devs modifying the same component)
- Keep this plan document updated as decisions are made
- Daily check-ins with shift partner at handoff

### Shift Partner — WOLF-2
When WOLF-1 is off, WOLF-2 has full lead authority. WOLF-2 must review the daily handoff note left in `HANDOFF.md` (in the project root) before starting their shift. WOLF-2 mirrors all of WOLF-1's responsibilities during their active hours.

**Handoff protocol:** At the end of every shift, the active lead updates `HANDOFF.md` with:
1. What was completed
2. What is in progress and who owns it
3. Any blockers or decisions made
4. What the next shift should prioritize

### Junior Developer A — Backend Core
**Assigned to:** Database schema, `botbotRoutes.ts`, LLM client, token ledger logic.
**Do not touch:** Frontend files, `startupBootstrap.ts` initial structure (add your schema function only), `routeWiring.ts` (ask WOLF-1 to wire your routes after review).
**Skill assumption:** Comfortable with TypeScript, Express, and raw SQL. Needs guidance on LLM API specifics — ask before assuming how the Anthropic SDK works.

### Junior Developer B — Frontend Infrastructure
**Assigned to:** BotBot orb component, chat panel, context provider, `App.tsx` wiring, `services/botbotApi.ts`.
**Do not touch:** Backend files, `types.ts` additions without showing me the shape first, `App.tsx` existing auth/nav logic (only add BotBot state and render the orb).
**Skill assumption:** Comfortable with React and TypeScript. May need guidance on framer-motion animation patterns — check existing `DashboardOverview.tsx` for motion examples before inventing your own.

### Junior Developer C — Frontend Features & Admin
**Assigned to:** Model selector, token meter, quota exceeded UX, admin panel inside chat panel, settings panel, page context wiring across all workspaces.
**Do not touch:** Core orb or chat panel structure (that's Dev B's domain — coordinate before editing).
**Skill assumption:** Comfortable with React but newer to complex state. Keep state as local as possible and bubble up only what's needed. When in doubt, ask.

---

## Project Overview

BotBot is a **persistent, floating AI assistant** embedded across all pages of the WOLF-FD dashboard. It is NOT a page or a tab — it is an always-available orb in the bottom-right corner of every screen that expands into a chat interface. It knows what page the user is on, what data they're looking at, and who they are.

BotBot supports multiple AI models with **per-model token quotas**. Employees get a free allocation per model. When they run out, they get a clear message. Owners can see usage across all employees and adjust quotas or reset them. This is the paywall infrastructure that will eventually support billing.

**BotBot is not WolfBot.** `WolfBot.tsx` is a Dialogflow call routing console for managing phone system AI. It stays exactly as it is. BotBot is a completely independent system living in `components/botbot/`.

### Goals
1. Floating orb visible on all authenticated dashboard pages
2. Chat panel with real AI responses (Ollama local model + Claude API)
3. Page-aware context injected into every AI prompt
4. Token usage tracked per user per model in the database
5. Configurable free quotas per model, enforced server-side
6. Owner admin panel for usage visibility and quota management
7. Personalization (custom assistant name, color theme)
8. Onboarding flow for first-time users
9. Engagement hooks (milestones, usage stats) — Phase 5, lower priority

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WOLF-FD Frontend                            │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  App.tsx — renders BotBotOrb in fixed position outside       │   │
│  │  main content area, passes authUser + isDarkMode             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  BotBotContextProvider (wraps entire app)                    │  │
│  │  Holds: pageContext (what page, what data, what role)        │  │
│  │  Each workspace calls setPageContext() on mount/tab change   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐   │
│  │ BotBotOrb   │───►│ BotBotChatPanel                          │   │
│  │ (fixed pos) │    │  ├── Model selector dropdown             │   │
│  │             │    │  ├── Conversation list                   │   │
│  │ States:     │    │  ├── Message bubbles                     │   │
│  │ idle/glow/  │    │  ├── Typing indicator                    │   │
│  │ bounce/badge│    │  ├── Token meter (per model)             │   │
│  └─────────────┘    │  ├── Quota exceeded banner               │   │
│                     │  ├── Input bar                           │   │
│                     │  └── Settings / Admin tab (Owner only)   │   │
│                     └──────────────────────────────────────────┘   │
│                                        │                            │
│                              services/botbotApi.ts                  │
└────────────────────────────────────────┼────────────────────────────┘
                                         │ HTTPS / cookie auth
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                pos-dashboard-backend  (Express, port 5057)          │
│                                                                     │
│  routeWiring.ts ──► registerBotBotRoutes({ app, pool, requireOwner})│
│                                                                     │
│  src/routes/botbotRoutes.ts                                         │
│   ├── GET  /api/botbot/models              (model config list)      │
│   ├── GET  /api/botbot/conversations       (user's threads)         │
│   ├── POST /api/botbot/conversations       (create thread)          │
│   ├── PATCH /api/botbot/conversations/:id  (update title)           │
│   ├── DELETE /api/botbot/conversations/:id (delete thread)          │
│   ├── GET  /api/botbot/conversations/:id/messages                   │
│   ├── POST /api/botbot/conversations/:id/messages  ◄── CORE         │
│   ├── GET  /api/botbot/token-usage         (user's own usage)       │
│   ├── GET  /api/botbot/settings            (user personalization)   │
│   ├── PUT  /api/botbot/settings                                     │
│   ├── GET  /api/botbot/admin/usage         (Owner only)             │
│   ├── GET  /api/botbot/admin/model-config  (Owner only)             │
│   ├── PATCH /api/botbot/admin/model-config/:modelKey (Owner only)   │
│   └── POST /api/botbot/admin/reset-user-quota (Owner only)          │
│                                                                     │
│  src/llmClient.ts                                                   │
│   ├── callOllama(model, messages, systemPrompt)                     │
│   └── callClaude(modelKey, messages, systemPrompt)                  │
│                                                                     │
│  src/botbotPrompt.ts                                                │
│   └── buildSystemPrompt(user, pageContext, settings)                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ pg Pool
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL (salesdb)                        │
│                                                                     │
│  botbot_model_config    botbot_conversations    botbot_messages      │
│  botbot_token_ledger    botbot_settings         botbot_usage         │
└─────────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
   Ollama (local)                  Anthropic Claude API
   http://127.0.0.1:11434          api.anthropic.com
   model: qwen2.5:0.5b             claude-haiku-4-5
   (always available)              claude-sonnet-4-5
                                   (requires API key)
```

---

## Database Schema

**Owner: Junior Developer A** — Add a single `async function ensureBotBotSchema(pool: Pool)` function to `startupBootstrap.ts`. Call it from `runStartupBootstrap()` at the end, after all existing schema calls. Follow the exact existing pattern: `CREATE TABLE IF NOT EXISTS` then `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each column (idempotent migration shim). Seed data uses `INSERT ... ON CONFLICT DO NOTHING`.

### Table 1: `botbot_model_config`

Stores owner-configurable settings per AI model. This is the source of truth for what models are available and what the free quota is.

```sql
CREATE TABLE IF NOT EXISTS botbot_model_config (
  model_key         TEXT PRIMARY KEY,
  display_name      TEXT NOT NULL DEFAULT '',
  provider          TEXT NOT NULL DEFAULT '',
  ollama_model_name TEXT NOT NULL DEFAULT '',
  free_token_quota  BIGINT NOT NULL DEFAULT 0,
  enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADD COLUMN IF NOT EXISTS for each column above (migration shim)
ALTER TABLE botbot_model_config ADD COLUMN IF NOT EXISTS model_key TEXT;
-- (continue for all columns)

-- Seed data
INSERT INTO botbot_model_config
  (model_key, display_name, provider, ollama_model_name, free_token_quota, enabled, sort_order)
VALUES
  ('local',            'Local AI (Fast)',   'ollama',    'qwen2.5:0.5b', 500000, TRUE, 1),
  ('claude-haiku-4-5', 'Claude Haiku',      'anthropic', '',              50000, TRUE, 2),
  ('claude-sonnet-4-5','Claude Sonnet',     'anthropic', '',              10000, TRUE, 3)
ON CONFLICT (model_key) DO NOTHING;
```

**Column notes:**
- `model_key`: Internal identifier used everywhere. For Ollama models, always `'local'` as the key regardless of what Ollama model is active underneath — this way swapping Ollama models doesn't break frontend references.
- `ollama_model_name`: Only meaningful when `provider = 'ollama'`. This is the actual model name passed to the Ollama API (e.g. `qwen2.5:0.5b`).
- `free_token_quota`: Combined input+output token budget per user. After this many tokens across all conversations with this model, the user hits their limit.
- `enabled`: Owner can disable a model without deleting its config or usage records.

---

### Table 2: `botbot_conversations`

One row per chat thread. Users can have multiple conversations. Each conversation is locked to one model (the model chosen when it was created).

```sql
CREATE TABLE IF NOT EXISTS botbot_conversations (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'New Chat',
  model_key    TEXT NOT NULL DEFAULT 'local',
  context_tag  TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botbot_conv_user
  ON botbot_conversations(user_id, updated_at DESC);
```

**Column notes:**
- `model_key`: Snapshot of the model at the time of conversation creation. Changing the model selector creates a new conversation, it does not change the model of an existing one.
- `context_tag`: A short string identifying where in the dashboard this conversation was started. Examples: `'sales'`, `'crm'`, `'amp'`, `'board'`, `''` (main dashboard). Used only for reference and potential future filtering.
- `updated_at`: Updated every time a message is sent in this conversation. Used to order the conversation list by recency.

---

### Table 3: `botbot_messages`

Every message turn in a conversation — both user and assistant messages.

```sql
CREATE TABLE IF NOT EXISTS botbot_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES botbot_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  model_key       TEXT NOT NULL DEFAULT '',
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  finish_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botbot_messages_conv
  ON botbot_messages(conversation_id, id ASC);
```

**Column notes:**
- `role`: `'user'` or `'assistant'`. System messages are not stored — they are constructed fresh from `botbotPrompt.ts` on every request.
- `input_tokens` / `output_tokens`: Only meaningful on `role = 'assistant'` rows. Populated from the LLM's response usage data. User message rows will always have 0 here. We get the input token count from the LLM's response (it tells us how many tokens it processed), not from counting ourselves.
- `finish_reason`: `'stop'` (normal), `'length'` (hit max_tokens limit), `'error'` (LLM call failed but we still stored the row). If `finish_reason = 'error'`, content will contain a user-friendly error message and tokens will be 0.

---

### Table 4: `botbot_token_ledger`

Running total of tokens used per user per model. This is the fast-path quota check. Do not recalculate this from `botbot_messages` on every request — that would be slow. Maintain this as an atomic running total.

```sql
CREATE TABLE IF NOT EXISTS botbot_token_ledger (
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_key         TEXT NOT NULL,
  tokens_used       BIGINT NOT NULL DEFAULT 0,
  tokens_purchased  BIGINT NOT NULL DEFAULT 0,
  last_reset_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, model_key)
);

CREATE INDEX IF NOT EXISTS idx_botbot_ledger_user
  ON botbot_token_ledger(user_id);
```

**Column notes:**
- `tokens_used`: Cumulative input+output tokens across all conversations with this model. Only increases (or resets to 0 by Owner action).
- `tokens_purchased`: Always 0 for now. Reserved for future billing. When billing is implemented, you add tokens here instead of resetting `tokens_used`. Quota check is: `tokens_used <= free_token_quota + tokens_purchased`.
- `last_reset_at`: Updated when an Owner resets a user's quota. Useful for audit trail.
- The UPSERT pattern for incrementing is atomic in PostgreSQL: `ON CONFLICT DO UPDATE SET tokens_used = botbot_token_ledger.tokens_used + EXCLUDED.tokens_used`. No race conditions.

---

### Table 5: `botbot_settings`

Per-user personalization. One row per user, created on first save.

```sql
CREATE TABLE IF NOT EXISTS botbot_settings (
  user_id              BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  assistant_name       TEXT NOT NULL DEFAULT 'BotBot',
  assistant_theme      TEXT NOT NULL DEFAULT 'sky',
  tutorial_completed   BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_model_key  TEXT NOT NULL DEFAULT 'local',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Column notes:**
- `assistant_name`: What the employee has named their bot. Shown in the orb tooltip and chat header.
- `assistant_theme`: Color theme for the orb and panel. Valid values: `'sky'`, `'emerald'`, `'violet'`, `'amber'`, `'rose'`, `'teal'`.
- `tutorial_completed`: Whether the user has seen the onboarding flow. If FALSE, BotBot opens automatically on first login.
- `preferred_model_key`: The model the user last selected. Pre-populated in the model selector when they open BotBot.

---

### Table 6: `botbot_usage`

Session-level usage tracking for milestones and leaderboard. Updated by the frontend every 60 seconds while BotBot is open, and on close.

```sql
CREATE TABLE IF NOT EXISTS botbot_usage (
  id                      BIGSERIAL PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_start           TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_minutes         INTEGER NOT NULL DEFAULT 0,
  total_lifetime_minutes  INTEGER NOT NULL DEFAULT 0,
  last_active             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botbot_usage_user
  ON botbot_usage(user_id, session_start DESC);
```

**Note:** Milestone tracking (Phase 5) queries this table. This table is LOW priority — the schema should be created with everything else, but the routes and frontend wiring for milestones come in Phase 5.

---

## Environment Variables

**Owner: WOLF-1** will add these to `runtimeConfig.ts`. Dev A should import them from there — do not call `process.env` directly anywhere in your route or client files.

```typescript
// Add to pos-dashboard-backend/src/runtimeConfig.ts

export const OLLAMA_BASE_URL =
  envString('OLLAMA_BASE_URL', 'http://127.0.0.1:11434') ?? 'http://127.0.0.1:11434';

export const ANTHROPIC_API_KEY =
  envString('ANTHROPIC_API_KEY', '') ?? '';

export const BOTBOT_ENABLED =
  envString('BOTBOT_ENABLED', 'true') === 'true';
```

Add to `/home/alphahs/WOLF-CENTRAL.env` (done manually by the server owner, NOT committed to git):
```env
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://127.0.0.1:11434
BOTBOT_ENABLED=true
```

---

## Backend Implementation

### New package installation

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm install @anthropic-ai/sdk
```

Add to `package.json` dependencies: `"@anthropic-ai/sdk": "^0.39.0"`

---

### `src/llmClient.ts` (NEW — Dev A)

Single file, two exported functions. Keep them pure — no database access, no Express imports. Input goes in, text + token counts come out.

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { OLLAMA_BASE_URL, ANTHROPIC_API_KEY } from './runtimeConfig';

export type LLMMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LLMResponse = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export async function callOllama(
  ollamaModelName: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  const body = {
    model: ollamaModelName,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: false,
    options: { temperature: 0.7 },
  };

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as any;
  return {
    text: data.message?.content ?? '',
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
  };
}

export async function callClaude(
  modelKey: string,
  messages: LLMMessage[],
  systemPrompt: string
): Promise<LLMResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('model_unavailable');
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: modelKey,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as any).text)
    .join('');

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
```

**Critical:** Do not instantiate the `Anthropic` client at module load time. Instantiate it inside `callClaude` on every call. This way, if the API key is added to the env file and the server is restarted, it picks it up cleanly. Also means the server doesn't crash on startup if the key is missing.

---

### `src/botbotPrompt.ts` (NEW — Dev A)

```typescript
export type PageContext = {
  pageName: string;
  module: string;
  userRole: string;
  keyMetricsVisible: string[];
  suggestedActions: string[];
};

const CONTEXT_DESCRIPTIONS: Record<string, string> = {
  sales:   'viewing the Sales Dashboard with performance analytics and reports',
  crm:     'working in the CRM workspace managing leads and follow-ups',
  crm_planner: 'planning tasks and appointments in the CRM Planner',
  kiosks:  'monitoring AlphaOS kiosk and tablet device status',
  board:   'on the Message Board communicating with their team',
  amp:     'in the AMP workspace managing marketing and social content',
  amp_bot: 'in the WOLFbot AI/call routing configuration panel',
  shop:    'in the Shop workspace browsing inventory and catalogs',
  pulse:   'viewing AlphaPulse business intelligence data',
  den:     'in the Wolfden workspace',
  tasks:   'managing their task list',
  settings: 'in the Owner Settings panel',
  '':      'on the main dashboard overview',
};

export function buildSystemPrompt(
  userName: string,
  assistantName: string,
  pageContext: PageContext
): string {
  const contextDesc =
    CONTEXT_DESCRIPTIONS[pageContext.module] ??
    CONTEXT_DESCRIPTIONS[''];

  const metricsLine = pageContext.keyMetricsVisible.length > 0
    ? `Visible metrics on screen: ${pageContext.keyMetricsVisible.join(', ')}.`
    : '';

  const actionsLine = pageContext.suggestedActions.length > 0
    ? `Available actions on this page: ${pageContext.suggestedActions.join(', ')}.`
    : '';

  return [
    `You are ${assistantName}, the personal AI assistant embedded in the WOLF-FD dashboard for Furniture Distributors.`,
    `You are helping ${userName}, who has the role of ${pageContext.userRole}.`,
    `They are currently ${contextDesc}.`,
    metricsLine,
    actionsLine,
    `Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
    `Keep your responses concise — 2 to 4 sentences unless the user asks for detail.`,
    `Be friendly, practical, and direct. You know this is a furniture retail business.`,
    `Never make up specific sales numbers or customer data you haven't been told.`,
    `If you don't know something, say so and suggest where to look in the dashboard.`,
  ].filter(Boolean).join('\n');
}
```

---

### `src/routes/botbotRoutes.ts` (NEW — Dev A)

This is the largest file Dev A will write. Organize it into clearly labeled sections with comments. No function should exceed 60 lines. If a helper is getting complex, extract it.

```typescript
import type { Express } from 'express';
import type { Pool } from 'pg';
import { callOllama, callClaude, type LLMMessage } from '../llmClient';
import { buildSystemPrompt, type PageContext } from '../botbotPrompt';

type BotBotRoutesDeps = {
  app: Express;
  pool: Pool;
  requireOwner: (req: any, res: any, next: any) => void;
};

const HISTORY_LIMIT = 20; // last N messages sent to LLM
const MAX_RESPONSE_MESSAGES = 200; // max messages returned to frontend

export function registerBotBotRoutes({ app, pool, requireOwner }: BotBotRoutesDeps): void {
  // ── helpers ────────────────────────────────────────────────────────
  const getAuthUser = (req: any) => (req as any).authUser as { id: string; name: string; roles: string[] } | undefined;
  const userId = (req: any): number => parseInt(getAuthUser(req)!.id, 10);

  // ── GET /api/botbot/models ─────────────────────────────────────────
  // Returns enabled models with free_token_quota
  // Used by frontend to populate model selector
  app.get('/api/botbot/models', async (_req, res) => {
    const r = await pool.query(
      `SELECT model_key, display_name, provider, free_token_quota, sort_order
       FROM botbot_model_config
       WHERE enabled = TRUE
       ORDER BY sort_order ASC`
    );
    res.json({ models: r.rows });
  });

  // ── GET /api/botbot/conversations ─────────────────────────────────
  app.get('/api/botbot/conversations', async (req, res) => {
    const uid = userId(req);
    const r = await pool.query(
      `SELECT c.id, c.title, c.model_key, c.context_tag, c.updated_at,
              COUNT(m.id)::int AS message_count
       FROM botbot_conversations c
       LEFT JOIN botbot_messages m ON m.conversation_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.updated_at DESC
       LIMIT 50`,
      [uid]
    );
    res.json({ conversations: r.rows });
  });

  // ── POST /api/botbot/conversations ────────────────────────────────
  app.post('/api/botbot/conversations', async (req, res) => {
    const uid = userId(req);
    const { modelKey = 'local', title = 'New Chat', contextTag = '' } = req.body ?? {};

    // Validate model exists and is enabled
    const modelCheck = await pool.query(
      `SELECT model_key FROM botbot_model_config WHERE model_key = $1 AND enabled = TRUE`,
      [modelKey]
    );
    if (modelCheck.rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid_model' });
    }

    const r = await pool.query(
      `INSERT INTO botbot_conversations (user_id, title, model_key, context_tag)
       VALUES ($1, $2, $3, $4)
       RETURNING id, title, model_key, context_tag, created_at, updated_at`,
      [uid, title, modelKey, contextTag]
    );
    res.status(201).json({ conversation: r.rows[0] });
  });

  // ── PATCH /api/botbot/conversations/:id ───────────────────────────
  app.patch('/api/botbot/conversations/:id', async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);
    const { title } = req.body ?? {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ ok: false, error: 'title_required' });
    }
    const r = await pool.query(
      `UPDATE botbot_conversations
       SET title = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, title`,
      [title.slice(0, 100), convId, uid]
    );
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ conversation: r.rows[0] });
  });

  // ── DELETE /api/botbot/conversations/:id ──────────────────────────
  app.delete('/api/botbot/conversations/:id', async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);
    const r = await pool.query(
      `DELETE FROM botbot_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [convId, uid]
    );
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true });
  });

  // ── GET /api/botbot/conversations/:id/messages ────────────────────
  app.get('/api/botbot/conversations/:id/messages', async (req, res) => {
    const uid = userId(req);
    const convId = parseInt(req.params.id, 10);

    // Ownership check
    const ownerCheck = await pool.query(
      `SELECT id FROM botbot_conversations WHERE id = $1 AND user_id = $2`,
      [convId, uid]
    );
    if (ownerCheck.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });

    const r = await pool.query(
      `SELECT id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at
       FROM botbot_messages
       WHERE conversation_id = $1
       ORDER BY id ASC
       LIMIT $2`,
      [convId, MAX_RESPONSE_MESSAGES]
    );
    res.json({ messages: r.rows });
  });

  // ── POST /api/botbot/conversations/:id/messages ── CORE ENDPOINT ──
  app.post('/api/botbot/conversations/:id/messages', async (req, res) => {
    const uid = userId(req);
    const user = getAuthUser(req)!;
    const convId = parseInt(req.params.id, 10);
    const { content, pageContext } = req.body ?? {};

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ ok: false, error: 'content_required' });
    }

    // 1. Load conversation + verify ownership
    const convResult = await pool.query(
      `SELECT id, model_key, context_tag FROM botbot_conversations WHERE id = $1 AND user_id = $2`,
      [convId, uid]
    );
    if (convResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    const conv = convResult.rows[0];

    // 2. Load model config
    const modelResult = await pool.query(
      `SELECT model_key, provider, ollama_model_name, free_token_quota, enabled
       FROM botbot_model_config WHERE model_key = $1`,
      [conv.model_key]
    );
    if (modelResult.rows.length === 0 || !modelResult.rows[0].enabled) {
      return res.status(503).json({ ok: false, error: 'model_unavailable' });
    }
    const model = modelResult.rows[0];

    // 3. Load current token usage (LEFT JOIN so missing row = 0)
    const ledgerResult = await pool.query(
      `SELECT COALESCE(tokens_used, 0) AS tokens_used,
              COALESCE(tokens_purchased, 0) AS tokens_purchased
       FROM botbot_token_ledger
       WHERE user_id = $1 AND model_key = $2`,
      [uid, conv.model_key]
    );
    const ledger = ledgerResult.rows[0] ?? { tokens_used: 0, tokens_purchased: 0 };
    const tokensUsed = parseInt(ledger.tokens_used, 10);
    const tokensPurchased = parseInt(ledger.tokens_purchased, 10);
    const quota = parseInt(model.free_token_quota, 10);

    // 4. Pre-flight quota check
    if (tokensUsed >= quota + tokensPurchased) {
      return res.status(402).json({
        ok: false,
        error: 'quota_exceeded',
        modelKey: conv.model_key,
        displayName: model.display_name ?? conv.model_key,
        tokensUsed,
        quota,
      });
    }

    // 5. Insert user message row
    await pool.query(
      `INSERT INTO botbot_messages (conversation_id, role, content, model_key, input_tokens, output_tokens)
       VALUES ($1, 'user', $2, $3, 0, 0)`,
      [convId, content.trim(), conv.model_key]
    );

    // 6. Fetch recent history for LLM
    const historyResult = await pool.query(
      `SELECT role, content FROM botbot_messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [convId, HISTORY_LIMIT]
    );
    const history: LLMMessage[] = historyResult.rows.reverse();

    // 7. Load user settings for assistant name
    const settingsResult = await pool.query(
      `SELECT assistant_name FROM botbot_settings WHERE user_id = $1`,
      [uid]
    );
    const assistantName = settingsResult.rows[0]?.assistant_name ?? 'BotBot';

    // 8. Build system prompt
    const ctx: PageContext = pageContext ?? {
      pageName: 'Dashboard',
      module: conv.context_tag ?? '',
      userRole: user.roles?.[0] ?? 'Employee',
      keyMetricsVisible: [],
      suggestedActions: [],
    };
    const systemPrompt = buildSystemPrompt(user.name, assistantName, ctx);

    // 9. Call LLM
    let llmResponse: { text: string; inputTokens: number; outputTokens: number };
    try {
      if (model.provider === 'ollama') {
        llmResponse = await callOllama(model.ollama_model_name, history, systemPrompt);
      } else if (model.provider === 'anthropic') {
        llmResponse = await callClaude(conv.model_key, history, systemPrompt);
      } else {
        throw new Error('unknown_provider');
      }
    } catch (err: any) {
      const errMsg = err.message === 'model_unavailable'
        ? 'Claude models are not configured on this server. Please use Local AI.'
        : 'Something went wrong. Please try again.';

      const errRow = await pool.query(
        `INSERT INTO botbot_messages
           (conversation_id, role, content, model_key, input_tokens, output_tokens, finish_reason)
         VALUES ($1, 'assistant', $2, $3, 0, 0, 'error')
         RETURNING id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at`,
        [convId, errMsg, conv.model_key]
      );
      return res.status(200).json({
        message: errRow.rows[0],
        tokensUsed,
        quota,
        quotaRemaining: Math.max(0, quota + tokensPurchased - tokensUsed),
        error: err.message,
      });
    }

    // 10. Insert assistant message
    const msgResult = await pool.query(
      `INSERT INTO botbot_messages
         (conversation_id, role, content, model_key, input_tokens, output_tokens, finish_reason)
       VALUES ($1, 'assistant', $2, $3, $4, $5, 'stop')
       RETURNING id, role, content, model_key, input_tokens, output_tokens, finish_reason, created_at`,
      [convId, llmResponse.text, conv.model_key, llmResponse.inputTokens, llmResponse.outputTokens]
    );

    // 11. Upsert token ledger (atomic increment)
    const totalNew = llmResponse.inputTokens + llmResponse.outputTokens;
    await pool.query(
      `INSERT INTO botbot_token_ledger (user_id, model_key, tokens_used, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, model_key)
       DO UPDATE SET
         tokens_used = botbot_token_ledger.tokens_used + EXCLUDED.tokens_used,
         updated_at = now()`,
      [uid, conv.model_key, totalNew]
    );

    // 12. Update conversation recency
    await pool.query(
      `UPDATE botbot_conversations SET updated_at = now() WHERE id = $1`,
      [convId]
    );

    const newTokensUsed = tokensUsed + totalNew;
    res.json({
      message: msgResult.rows[0],
      tokensUsed: newTokensUsed,
      quota,
      quotaRemaining: Math.max(0, quota + tokensPurchased - newTokensUsed),
    });
  });

  // ── GET /api/botbot/token-usage ───────────────────────────────────
  app.get('/api/botbot/token-usage', async (req, res) => {
    const uid = userId(req);
    const r = await pool.query(
      `SELECT l.model_key, m.display_name, m.free_token_quota AS quota,
              COALESCE(l.tokens_used, 0) AS tokens_used,
              COALESCE(l.tokens_purchased, 0) AS tokens_purchased
       FROM botbot_model_config m
       LEFT JOIN botbot_token_ledger l ON l.model_key = m.model_key AND l.user_id = $1
       WHERE m.enabled = TRUE
       ORDER BY m.sort_order ASC`,
      [uid]
    );
    const usage = r.rows.map(row => {
      const tokensUsed = parseInt(row.tokens_used, 10);
      const quota = parseInt(row.quota, 10);
      const tokensPurchased = parseInt(row.tokens_purchased, 10);
      const effective = quota + tokensPurchased;
      return {
        modelKey: row.model_key,
        displayName: row.display_name,
        tokensUsed,
        quota,
        quotaRemaining: Math.max(0, effective - tokensUsed),
        pctUsed: effective > 0 ? Math.min(100, Math.round((tokensUsed / effective) * 100)) : 0,
      };
    });
    res.json({ usage });
  });

  // ── GET /api/botbot/settings ──────────────────────────────────────
  app.get('/api/botbot/settings', async (req, res) => {
    const uid = userId(req);
    const r = await pool.query(
      `SELECT assistant_name, assistant_theme, tutorial_completed, preferred_model_key
       FROM botbot_settings WHERE user_id = $1`,
      [uid]
    );
    res.json({ settings: r.rows[0] ?? null });
  });

  // ── PUT /api/botbot/settings ──────────────────────────────────────
  app.put('/api/botbot/settings', async (req, res) => {
    const uid = userId(req);
    const {
      assistantName,
      assistantTheme,
      tutorialCompleted,
      preferredModelKey,
    } = req.body ?? {};

    const validThemes = ['sky', 'emerald', 'violet', 'amber', 'rose', 'teal'];
    const safeName = typeof assistantName === 'string'
      ? assistantName.trim().slice(0, 50) || 'BotBot'
      : undefined;
    const safeTheme = validThemes.includes(assistantTheme) ? assistantTheme : undefined;

    await pool.query(
      `INSERT INTO botbot_settings (user_id, assistant_name, assistant_theme, tutorial_completed, preferred_model_key)
       VALUES ($1,
         COALESCE($2, 'BotBot'),
         COALESCE($3, 'sky'),
         COALESCE($4, FALSE),
         COALESCE($5, 'local')
       )
       ON CONFLICT (user_id) DO UPDATE SET
         assistant_name      = COALESCE($2, botbot_settings.assistant_name),
         assistant_theme     = COALESCE($3, botbot_settings.assistant_theme),
         tutorial_completed  = COALESCE($4, botbot_settings.tutorial_completed),
         preferred_model_key = COALESCE($5, botbot_settings.preferred_model_key),
         updated_at = now()`,
      [uid, safeName, safeTheme, tutorialCompleted, preferredModelKey]
    );
    res.json({ ok: true });
  });

  // ── ADMIN ROUTES (Owner only) ──────────────────────────────────────

  // GET /api/botbot/admin/usage
  app.get('/api/botbot/admin/usage', requireOwner, async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10)));
    const offset = (page - 1) * limit;

    const r = await pool.query(
      `SELECT u.id AS user_id, u.name AS user_name, u.email,
              l.model_key, m.display_name, m.free_token_quota AS quota,
              COALESCE(l.tokens_used, 0) AS tokens_used,
              l.updated_at
       FROM botbot_token_ledger l
       JOIN users u ON u.id = l.user_id
       JOIN botbot_model_config m ON m.model_key = l.model_key
       ORDER BY l.tokens_used DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const countResult = await pool.query(`SELECT COUNT(*) FROM botbot_token_ledger`);
    res.json({ rows: r.rows, total: parseInt(countResult.rows[0].count, 10) });
  });

  // GET /api/botbot/admin/model-config
  app.get('/api/botbot/admin/model-config', requireOwner, async (_req, res) => {
    const r = await pool.query(
      `SELECT model_key, display_name, provider, ollama_model_name,
              free_token_quota, enabled, sort_order, updated_at
       FROM botbot_model_config
       ORDER BY sort_order ASC`
    );
    res.json({ models: r.rows });
  });

  // PATCH /api/botbot/admin/model-config/:modelKey
  app.patch('/api/botbot/admin/model-config/:modelKey', requireOwner, async (req, res) => {
    const { modelKey } = req.params;
    const { freeTokenQuota, displayName, enabled, sortOrder } = req.body ?? {};

    const updates: string[] = ['updated_at = now()'];
    const values: any[] = [modelKey];

    if (typeof freeTokenQuota === 'number' && freeTokenQuota >= 0) {
      values.push(freeTokenQuota);
      updates.push(`free_token_quota = $${values.length}`);
    }
    if (typeof displayName === 'string' && displayName.trim()) {
      values.push(displayName.trim());
      updates.push(`display_name = $${values.length}`);
    }
    if (typeof enabled === 'boolean') {
      values.push(enabled);
      updates.push(`enabled = $${values.length}`);
    }
    if (typeof sortOrder === 'number') {
      values.push(sortOrder);
      updates.push(`sort_order = $${values.length}`);
    }

    const r = await pool.query(
      `UPDATE botbot_model_config SET ${updates.join(', ')}
       WHERE model_key = $1
       RETURNING model_key, display_name, free_token_quota, enabled, sort_order`,
      values
    );
    if (r.rows.length === 0) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true, model: r.rows[0] });
  });

  // POST /api/botbot/admin/reset-user-quota
  app.post('/api/botbot/admin/reset-user-quota', requireOwner, async (req, res) => {
    const { userId: targetUserId, modelKey } = req.body ?? {};
    if (!targetUserId || !modelKey) {
      return res.status(400).json({ ok: false, error: 'userId and modelKey required' });
    }
    await pool.query(
      `UPDATE botbot_token_ledger
       SET tokens_used = 0, last_reset_at = now(), updated_at = now()
       WHERE user_id = $1 AND model_key = $2`,
      [parseInt(targetUserId, 10), modelKey]
    );
    res.json({ ok: true });
  });
}
```

---

### Register in `routeWiring.ts` (WOLF-1 will do this)

```typescript
// Add import
import { registerBotBotRoutes } from './routes/botbotRoutes';

// Add inside registerAllRoutes(), after registerTaskRoutes line
registerBotBotRoutes({ app, pool, requireOwner });
```

---

## Frontend Implementation

### `services/botbotApi.ts` (NEW — Dev B)

Follow the exact same `fetchJson` pattern as `services/posBackendApi.ts`. Use `credentials: "include"`. Import `getPosApiBaseUrl` from `posBackendApi`.

```typescript
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
  modelKey: string, title?: string, contextTag?: string
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

export const fetchSettings = (): Promise<BotBotSettings | null> =>
  fetchJson('/api/botbot/settings').then(r => r.settings);

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

// Admin
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
```

---

### `components/botbot/BotBotContext.tsx` (NEW — Dev B)

```typescript
import React, { createContext, useContext, useState } from 'react';
import type { PageContext } from '../../services/botbotApi';

type BotBotContextType = {
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
};

const defaultContext: PageContext = {
  pageName: 'Dashboard',
  module: '',
  userRole: 'Employee',
  keyMetricsVisible: [],
  suggestedActions: [],
};

const BotBotContext = createContext<BotBotContextType>({
  pageContext: defaultContext,
  setPageContext: () => {},
});

export const BotBotContextProvider: React.FC<{
  children: React.ReactNode;
  userRole: string;
}> = ({ children, userRole }) => {
  const [pageContext, setPageContextState] = useState<PageContext>({
    ...defaultContext,
    userRole,
  });

  const setPageContext = (ctx: PageContext) => {
    setPageContextState({ ...ctx, userRole });
  };

  return (
    <BotBotContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </BotBotContext.Provider>
  );
};

export const useBotBotContext = () => useContext(BotBotContext);
```

---

### `components/botbot/BotBotOrb.tsx` (NEW — Dev B)

The floating circular button in the bottom-right corner. Uses framer-motion for animation states. Must be rendered outside the main content scroll area.

**States:**
- `idle`: Subtle slow pulse (scale 1 → 1.05 → 1 on 3s loop)
- `thinking`: Fast bounce while waiting for AI response
- `notification`: Badge dot in top-right corner
- `expanded`: Orb is open (show X icon instead of bot icon)

**Theme colors** map to Tailwind classes:
```typescript
const THEME_COLORS: Record<string, { bg: string; ring: string; glow: string }> = {
  sky:     { bg: 'bg-sky-500',     ring: 'ring-sky-300',     glow: 'shadow-sky-300' },
  emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-300', glow: 'shadow-emerald-300' },
  violet:  { bg: 'bg-violet-500',  ring: 'ring-violet-300',  glow: 'shadow-violet-300' },
  amber:   { bg: 'bg-amber-500',   ring: 'ring-amber-300',   glow: 'shadow-amber-300' },
  rose:    { bg: 'bg-rose-500',    ring: 'ring-rose-300',    glow: 'shadow-rose-300' },
  teal:    { bg: 'bg-teal-500',    ring: 'ring-teal-300',    glow: 'shadow-teal-300' },
};
```

**Props:**
```typescript
type BotBotOrbProps = {
  isExpanded: boolean;
  isThinking: boolean;
  hasNotification: boolean;
  assistantName: string;
  theme: string;
  isDarkMode: boolean;
  onToggle: () => void;
};
```

Position: `fixed bottom-6 right-6 z-50` — always on top of everything.

---

### `components/botbot/BotBotChatPanel.tsx` (NEW — Dev B)

The panel that slides in from the bottom-right when the orb is clicked. Stays fixed on screen, does NOT scroll with page content.

**Layout (375px wide, 560px tall on desktop, full screen on mobile):**
```
┌──────────────────────────────────────┐
│ Header: [Bot icon] [Name] [Model]  [×]│
├──────────────────────────────────────┤
│ Conversation list (sidebar, 120px)   │
│  [+ New]  [conv 1]  [conv 2] ...     │
├──────────────────────────────────────┤
│ Messages area (scrollable)            │
│  User bubble (right, slate-900 bg)   │
│  Bot bubble (left, white/border)     │
│  Thinking indicator (3 dots)         │
├──────────────────────────────────────┤
│ Token meter                          │
│  ████░░░░ 12,450 / 50,000            │
├──────────────────────────────────────┤
│ [Quota exceeded banner — if needed]  │
├──────────────────────────────────────┤
│ Input: [textarea] [Send]             │
└──────────────────────────────────────┘
```

The panel animates in with framer-motion: `initial={{ opacity: 0, y: 20, scale: 0.95 }}`, `animate={{ opacity: 1, y: 0, scale: 1 }}`.

---

### `components/botbot/BotBotAdminPanel.tsx` (NEW — Dev C)

Rendered inside the chat panel when user role is Owner and they click an Admin tab. Shows:

1. **Usage table** — paginated list of all employees, token usage per model, % of quota used
2. **Model config** — for each model: editable `freeTokenQuota` (input, saves on blur), toggle enabled/disabled
3. **Reset buttons** — per user/model row

---

### `components/botbot/BotBotSettingsPanel.tsx` (NEW — Dev C)

Accessible from a gear icon in the chat panel header. Shows:

1. **Assistant name** — text input, saves on blur
2. **Color theme** — 6 color swatches, click to select
3. **Preferred model** — dropdown
4. **Reset tutorial** — button that sets `tutorialCompleted = false`
5. **Usage summary** — read-only token meter for each model

---

### `App.tsx` modifications (Dev B — careful scope)

Only add three things, touch nothing else:

1. Import `BotBotContextProvider` and `BotBotOrb` and `BotBotChatPanel` at the top
2. Add state: `const [botBotOpen, setBotBotOpen] = useState(false);`
3. Wrap the existing return JSX in `<BotBotContextProvider userRole={authUser?.roles?.[0] ?? 'Employee'}>` and render the orb + panel in fixed position outside the main content:

```tsx
// Inside the authenticated return, OUTSIDE main content div
<BotBotContextProvider userRole={authUser?.roles?.[0] ?? 'Employee'}>
  {/* existing main content ... */}
  <BotBotOrb
    isExpanded={botBotOpen}
    isThinking={false}  // Dev C wires this via a callback
    hasNotification={false}
    assistantName="BotBot"  // Dev C wires from settings
    theme="sky"             // Dev C wires from settings
    isDarkMode={isDarkMode}
    onToggle={() => setBotBotOpen(v => !v)}
  />
  {botBotOpen && (
    <BotBotChatPanel
      authUser={authUser}
      isDarkMode={isDarkMode}
      onClose={() => setBotBotOpen(false)}
    />
  )}
</BotBotContextProvider>
```

Dev C will refine the props wiring once settings are loaded. Start with hardcoded defaults.

---

### Page context wiring (Dev C)

Each workspace calls `setPageContext` when it mounts or when its active sub-tab changes. Example in `SalesDashboard.tsx`:

```typescript
import { useBotBotContext } from '../components/botbot/BotBotContext';

// Inside the component:
const { setPageContext } = useBotBotContext();

useEffect(() => {
  setPageContext({
    pageName: 'Sales Dashboard',
    module: 'sales',
    userRole: authUser?.roles?.[0] ?? 'Employee',
    keyMetricsVisible: ['Total Sales', 'Pro1st %', 'Units Sold'],
    suggestedActions: ['Print Report', 'View Trends', 'Export CSV'],
  });
}, [activeTab]);
```

**Dev C must wire this for:**
| Workspace | `module` value | `pageName` |
|---|---|---|
| `SalesDashboard.tsx` | `'sales'` | `'Sales Dashboard'` |
| `CRMWorkspace.tsx` | `'crm'` | `'CRM'` |
| `KiosksStatus.tsx` | `'kiosks'` | `'AlphaOS'` |
| `MessageBoard.tsx` | `'board'` | `'Message Board'` |
| `AmpWorkspace.tsx` | `'amp'` | `'AMP'` |
| `ShopWorkspace.tsx` | `'shop'` | `'Shop'` |
| `ProductSearchWorkspace.tsx` | `'shop'` | `'Product Search'` |
| `WolfdenWorkspace.tsx` | `'den'` | `'Wolfden'` |
| `PulseWorkspace.tsx` | `'pulse'` | `'AlphaPulse'` |
| `TaskManager.tsx` | `'tasks'` | `'Task Manager'` |
| `DashboardOverview.tsx` | `''` | `'Dashboard'` |

---

## Phase Breakdown & Assignments

### Phase 1 — Infrastructure (No visible UI yet)
**Owner: Dev A + WOLF-1**
- [Dev A] Write `ensureBotBotSchema()` and add to `startupBootstrap.ts`
- [Dev A] Write `llmClient.ts`
- [Dev A] Write `botbotPrompt.ts`
- [Dev A] Write `botbotRoutes.ts`
- [WOLF-1] Add env vars to `runtimeConfig.ts`
- [WOLF-1] Wire routes in `routeWiring.ts`
- [WOLF-1] `npm install @anthropic-ai/sdk` and update `package.json`
- [WOLF-1] Verify tables created and endpoints respond to curl

**Exit criteria for Phase 1:** All endpoints return valid JSON when hit with curl. Tables exist in DB. Ollama chat endpoint returns a real response. Quota exceeded returns 402.

---

### Phase 2 — Frontend Core (Orb visible, no real data)
**Owner: Dev B**
- [Dev B] Create `BotBotContext.tsx`
- [Dev B] Create `BotBotOrb.tsx` with animation states
- [Dev B] Create `BotBotChatPanel.tsx` with static layout
- [Dev B] Create `services/botbotApi.ts`
- [Dev B] Modify `App.tsx` — add state and render orb/panel

**Exit criteria for Phase 2:** Orb is visible in the bottom-right on all pages after login. Clicking it opens and closes the panel. Dark mode respected.

---

### Phase 3 — Real Chat (Wire frontend to backend)
**Owner: Dev B + Dev C collaborate**
- [Dev B] Wire `fetchConversations`, `createConversation`, `fetchMessages` into chat panel
- [Dev B] Wire `sendMessage` with optimistic UI and thinking indicator
- [Dev C] Wire model selector from `fetchBotBotModels`
- [Dev C] Wire token meter from `fetchTokenUsage` and `sendMessage` response
- [Dev C] Implement quota exceeded state and banner
- [Dev C] Implement auto-title on first message

**Exit criteria for Phase 3:** Employee can open BotBot, pick a model, send a message, get a real AI response, and see their token usage update.

---

### Phase 4 — Settings & Admin
**Owner: Dev C**
- [Dev C] Build `BotBotSettingsPanel.tsx`
- [Dev C] Wire settings load/save to `fetchSettings` / `saveSettings`
- [Dev C] Apply theme color and assistant name from settings to orb and panel
- [Dev C] Build `BotBotAdminPanel.tsx` — usage table and model config editing
- [Dev C] Wire admin API calls

**Exit criteria for Phase 4:** Owner can view all employee token usage, change quotas, reset a user's quota. Any user can change their bot's name and color.

---

### Phase 5 — Page Context & Polish
**Owner: Dev C + Dev B**
- [Dev C] Wire `setPageContext` calls in all workspaces (table above)
- [Dev B] Verify system prompt is enriched with correct context by checking network responses
- [Dev B] Add onboarding flow for `tutorial_completed = false` users (BotBot sends a welcome message automatically on first open)
- [Dev C] Usage milestone messages (check `total_lifetime_minutes` on settings load, show a milestone message if a threshold is crossed)
- [WOLF-1] Final QA pass, deployment sign-off

**Exit criteria for Phase 5:** BotBot knows what page the user is on. New users get a welcome message. Milestones trigger correctly.

---

## Coding Standards

These are not suggestions.

1. **No `any` in function signatures** — use proper types. Internal `req: any` in Express routes is the only accepted exception.
2. **All DB queries use parameterized values** — `$1, $2` etc. Never string-interpolate user input into SQL. This is a security requirement, not a style choice.
3. **Every new route file must follow the `registerXxxRoutes` export pattern** — no default exports, no arrow function exports, named function export only.
4. **Frontend components do NOT import directly from the backend** — all data flows through `services/botbotApi.ts`.
5. **useEffect dependencies must be correct** — if ESLint flags a missing dep, either add it or document explicitly why it's excluded with a comment. Do not silence the warning blindly.
6. **No hardcoded URLs or port numbers in frontend** — always go through `getPosApiBaseUrl()`.
7. **All new files must have a one-line comment at the top explaining their purpose.**

---

## Verification Checklist

Run through this before any phase is marked complete:

```
PHASE 1 — Backend
  [ ] psql: \dt botbot_* shows 6 tables
  [ ] SELECT * FROM botbot_model_config; shows 3 seed rows
  [ ] curl POST /api/botbot/conversations (with valid session cookie) returns 201
  [ ] curl POST .../messages with Ollama model returns AI response and token counts
  [ ] curl POST .../messages exceeding quota returns 402 with error: "quota_exceeded"
  [ ] curl GET /api/botbot/token-usage shows updated ledger
  [ ] curl GET /api/botbot/admin/usage (Owner session) returns usage rows
  [ ] curl PATCH /api/botbot/admin/model-config/local with new quota — verify SELECT confirms change

PHASE 2 — Frontend Core
  [ ] Orb is visible on: Dashboard, Sales, CRM, Message Board, Product Search
  [ ] Orb opens panel on click
  [ ] Panel closes on X click and on orb click when open
  [ ] Dark mode: orb and panel respect isDarkMode prop
  [ ] No console errors on any page

PHASE 3 — Real Chat
  [ ] Model selector populates from API
  [ ] Selecting a model and starting a new chat uses that model
  [ ] Sending a message shows optimistic user bubble immediately
  [ ] Thinking indicator shows while waiting
  [ ] AI response appears in panel
  [ ] Token meter updates after each message
  [ ] Hitting quota: input disabled, banner visible, clear message shown
  [ ] First message causes conversation title to update (check sidebar)

PHASE 4 — Settings & Admin
  [ ] Changing assistant name saves and persists on page refresh
  [ ] Changing theme color updates orb and panel immediately
  [ ] Owner sees Admin tab, others do not
  [ ] Admin usage table shows employees with token counts
  [ ] Owner can edit quota inline — saves on blur — next employee message check uses new value
  [ ] Owner reset quota button: employee can send messages again after reset

PHASE 5 — Context & Polish
  [ ] Navigate to Sales Dashboard: BotBot system prompt contains "Sales Dashboard"
  [ ] Navigate to CRM: system prompt contains "CRM"
  [ ] First-time user: BotBot sends welcome message automatically
  [ ] Milestone at 5h triggers (can test by manually inserting usage record)
```

---

## File Structure (Final)

```
/home/alphahs/WOLF-FD/
├── App.tsx                            MODIFY (Dev B — add BotBot state + render)
├── types.ts                           MODIFY (Dev B — add BotBotMessage, PageContext exports)
├── components/
│   └── botbot/
│       ├── index.ts                   NEW (Dev B — re-exports)
│       ├── BotBotContext.tsx          NEW (Dev B)
│       ├── BotBotOrb.tsx             NEW (Dev B)
│       ├── BotBotChatPanel.tsx       NEW (Dev B)
│       ├── BotBotSettingsPanel.tsx   NEW (Dev C)
│       └── BotBotAdminPanel.tsx      NEW (Dev C)
├── services/
│   └── botbotApi.ts                  NEW (Dev B)
└── pos-dashboard-backend/
    ├── package.json                   MODIFY (WOLF-1 — add @anthropic-ai/sdk)
    └── src/
        ├── runtimeConfig.ts           MODIFY (WOLF-1 — add OLLAMA_BASE_URL, ANTHROPIC_API_KEY, BOTBOT_ENABLED)
        ├── routeWiring.ts             MODIFY (WOLF-1 — import + register botbotRoutes)
        ├── startupBootstrap.ts        MODIFY (Dev A — add ensureBotBotSchema)
        ├── llmClient.ts              NEW (Dev A)
        ├── botbotPrompt.ts           NEW (Dev A)
        └── routes/
            └── botbotRoutes.ts       NEW (Dev A)

DO NOT TOUCH:
  components/WolfBot.tsx              (Dialogflow call routing — unrelated)
  pos-dashboard-backend/src/routes/authRoutes.ts  (ask WOLF-1 first)
```

---

*WOLF-1 — Lead Programmer*
*Document version: 1.0 — 2026-03-30*
*Next review: after Phase 2 exit criteria are met*
