# BotBot Implementation Questions

## For WOLF-1 / PM Review

---

### 1. Handoff Protocol File

**Q:** You mention `HANDOFF.md` in the project root for shift handoffs between WOLF-1 and WOLF-2, but it doesn't exist yet.

**Options:**
- (A) I create it now as part of the first commit
- (B) WOLF-2 creates it on their first shift
- (C) Skip the file, use a different mechanism

**Recommendation:** Option A — I'll create a basic `HANDOFF.md` template when we start implementation.

---

### 2. Rate Limiting on Message Endpoint

**Q:** The plan enforces token quotas but doesn't include rate limiting. With Ollama running locally, a runaway frontend loop or rapid message spam could hog the local model or database.

**Should we add rate limiting?**
- Per-user: max 1 message per second, or 10 messages per minute
- Implementation: simple in-memory Map or DB-based tracking

**Recommendation:** Add basic per-user rate limiting (e.g., 10 messages/minute) to prevent abuse.

---

### 3. Error Message UX Differentiation

**Q:** The backend returns `finish_reason = 'error'` with a generic message, but different error types might need different user actions:

- `Claude not configured` → User should switch to Local AI or ask Owner to set up Claude
- `Ollama is down` → User should try Claude API if available
- `Network error` → User should retry

**Should we add a typed error system in the frontend to map error codes to actionable UI?**

---

### 4. Tutorial Integration

**Q:** The existing codebase has:
- `components/app/TutorialOverlay.tsx` — existing tutorial UI
- `components/app/TutorialPromptOverlay.tsx` — login prompt for tutorial

The plan includes `tutorial_completed` in `botbot_settings` but doesn't specify how BotBot interacts with these existing components.

**Options:**
- (A) Keep existing tutorials as-is; BotBot has its own separate onboarding flow
- (B) Rewire existing tutorials to be triggered/controlled by BotBot (BotBot guides users through the tutorial)
- (C) Replace existing tutorial with BotBot-guided experience
- (D) Not sure yet, need to review existing tutorial components

**Which approach should we take?**

---

### 5. Phase 1 Scope Confirmation

**Q:** To start implementation, I'll begin with Junior Developer A's backend core:
- DB schema in `startupBootstrap.ts` (6 tables)
- `src/llmClient.ts` (Ollama + Claude clients)
- `src/botbotPrompt.ts` (system prompt builder)
- `src/routes/botbotRoutes.ts` (all API endpoints)
- Register routes in `routeWiring.ts`

**Should I proceed with this scope for Phase 1?**

---

### 6. Environment Variables

**Q:** The plan mentions adding to `runtimeConfig.ts`:
- `OLLAMA_BASE_URL`
- `ANTHROPIC_API_KEY`
- `BOTBOT_ENABLED`

**Should I add these now, or wait until the backend code is ready?**

---

## Priority

Most urgent: **#4 (Tutorial)** and **#5 (Phase 1 scope)** — need alignment before code starts.

Less urgent: #1, #2, #3 can be addressed during or after Phase 1.

---

## WOLF-1 Decisions (2026-03-30)

### #1 Handoff Protocol File
**DECISION: Option A** ✓

I'll create `HANDOFF.md` template now, committed with the first Phase 1 work. WOLF-2 updates it at shift end.

---

### #2 Rate Limiting
**DECISION: Yes, add it. Simple version.** ✓

Rate limit: **10 messages per user per minute**. Implement as in-memory Map with timestamp tracking in `botbotRoutes.ts`. When limit hit, return HTTP 429 with message: *"You're sending messages too fast. Wait a moment and try again."*

Can be added in Phase 1 or patched in Phase 3 — non-blocking.

---

### #3 Error Message UX Differentiation
**DECISION: Yes, use structured error codes.** ✓

Return error codes instead of generic messages:
```typescript
{
  ok: false,
  error: "model_unavailable",
  errorCode: "claude_not_configured" | "ollama_down" | "network_error" | "quota_exceeded" | "rate_limited"
}
```
Frontend maps these to actionable messages in Phase 3.

---

### #4 Tutorial Integration
**DECISION: Option A — Keep separate.** ✓

Existing `TutorialOverlay` is for the main dashboard. BotBot has **its own simple onboarding:**

When a new user opens BotBot (`tutorial_completed = false`), BotBot automatically sends a welcome message in the chat. That's it — no modal, no overlay. Simple and elegant. Mark `tutorial_completed = true` after sending it.

No integration needed with existing tutorial system.

---

### #5 Phase 1 Scope Confirmation
**DECISION: Yes, proceed exactly as described.** ✓

Dev A's Phase 1 scope is locked:
- 6 DB tables in `ensureBotBotSchema()`
- `llmClient.ts` (Ollama + Claude clients)
- `botbotPrompt.ts` (system prompt builder)
- `botbotRoutes.ts` (all API endpoints)
- Register in `routeWiring.ts`

No frontend code. No UI. Exit criteria: endpoints return JSON via curl, tables exist, Ollama calls work, quota enforcement works.

---

### #6 Environment Variables
**DECISION: Add them now.** ✓

Added to `runtimeConfig.ts`:
```typescript
export const OLLAMA_BASE_URL = envString('OLLAMA_BASE_URL', 'http://127.0.0.1:11434') ?? 'http://127.0.0.1:11434';
export const ANTHROPIC_API_KEY = envString('ANTHROPIC_API_KEY', '') ?? '';
export const BOTBOT_ENABLED = envString('BOTBOT_ENABLED', 'true') === 'true';
```

Safe to add now. Server handles empty API key gracefully.

---

**Status: PHASE 1 COMPLETE** ✓

✅ All Phase 1 work completed:
- DB schema created (6 tables)
- Seed data inserted (3 models)
- LLM client implemented (Ollama + Claude)
- System prompt builder implemented
- All API routes implemented with rate limiting + error codes
- Backend builds successfully
- PM2 restarted, health OK
- HANDOFF.md created

Ready for Phase 2: Frontend infrastructure
