# BotBot Developer Onboarding

Welcome to the BotBot implementation team. This document is for new developers joining the project.

---

## Before You Code — Read These (In Order)

1. **BOTBOT_MASTER_PLAN.md** — The complete spec. Read it fully, not skimmed.
2. **BOTBOT_QUESTIONS.md** — FAQs and WOLF-1's decisions on edge cases.
3. **This file (you are here)** — Team structure and communication.

---

## Who You Are (Pick One)

### Junior Developer A — Backend Core
You own the database and API routes.

**Your scope:**
- `pos-dashboard-backend/src/startupBootstrap.ts` — Add `ensureBotBotSchema()` function
- `pos-dashboard-backend/src/llmClient.ts` — Ollama + Claude API clients
- `pos-dashboard-backend/src/botbotPrompt.ts` — System prompt builder
- `pos-dashboard-backend/src/routes/botbotRoutes.ts` — All 11 API endpoints
- `pos-dashboard-backend/package.json` — Add @anthropic-ai/sdk dependency

**Do NOT touch:**
- Frontend files
- `startupBootstrap.ts` existing structure (only add your function)
- `routeWiring.ts` (WOLF-1 wires your routes after review)
- `runtimeConfig.ts` (WOLF-1 adds env vars)

**Your first task (Phase 1):**
Write the DB schema and LLM client. Exit criteria: tables exist, curl tests pass quota enforcement, Ollama returns real responses.

**Skill baseline:** Comfortable with TypeScript, Express, PostgreSQL, async/await. First time with Anthropic SDK is OK — the code examples are in the plan.

---

### Junior Developer B — Frontend Core
You own the orb, chat panel, and context system.

**Your scope:**
- `components/botbot/BotBotContext.tsx` — React context for page awareness
- `components/botbot/BotBotOrb.tsx` — Floating button with animations
- `components/botbot/BotBotChatPanel.tsx` — Chat UI (no real data yet)
- `services/botbotApi.ts` — Typed fetch wrappers to backend
- `App.tsx` — Add BotBot state and render orb/panel (small, focused changes)

**Do NOT touch:**
- Backend files
- Other workspaces (Dev C handles that)
- WolfBot.tsx (Dialogflow call routing — unrelated system)
- Existing auth/nav logic in App.tsx

**Your first task (Phase 2):**
Get the orb visible and the panel opening/closing. Make it respect dark mode. Exit criteria: orb clickable on all pages, panel animates in and out.

**Skill baseline:** Comfortable with React, framer-motion is a bonus but the examples exist in the codebase (`DashboardOverview.tsx`). Ask before you invent animation patterns.

---

### Junior Developer C — Frontend Features & Admin
You own settings, admin panel, token meter, and workspace context wiring.

**Your scope:**
- `components/botbot/BotBotSettingsPanel.tsx` — User settings (name, color, model preference)
- `components/botbot/BotBotAdminPanel.tsx` — Owner usage dashboard
- Wire page context in all workspaces (9 files: Sales, CRM, Kiosks, Message Board, AMP, Shop, Product Search, Wolfden, Pulse, Task Manager)
- Token meter display and quota exceeded state
- Model selector in chat panel
- Auto-title on first message

**Do NOT touch:**
- Core orb or chat panel (Dev B's domain — coordinate before editing)
- Backend files
- WolfBot.tsx

**Your first task (Phase 3+):**
Once Dev B has the chat panel working, you wire the model selector and token meter. Then add settings. Exit criteria: User can change assistant name and color; Owner can view all employee usage and change quotas.

**Skill baseline:** Comfortable with React and component state. New to complex state management is OK — keep state local and bubble up only what's needed.

---

## How to Introduce Yourself

When you start:

1. **Read the docs above** (really, all of them)
2. **Send a message to WOLF-1** with:
   - Your name / Discord handle / Slack name (wherever your team communicates)
   - Which Dev role you are (A, B, or C)
   - Your timezone
   - Rough hours you'll be working
   - Any blockers before you can start (missing tools, DB not accessible, etc.)
3. **Bookmark this folder** for quick reference:
   - `/home/alphahs/WOLF-FD/BOTBOT_MASTER_PLAN.md`
   - `/home/alphahs/WOLF-FD/BOTBOT_QUESTIONS.md`
   - `/home/alphahs/WOLF-FD/DEVELOPER_ONBOARDING.md`

---

## How We Communicate

### For Questions About the Spec
1. **Check BOTBOT_QUESTIONS.md first** — your answer might be there
2. **If not answered:** Find the section in BOTBOT_MASTER_PLAN.md and note the line number. Message WOLF-1:
   > "Dev A here — question about line 847 in BOTBOT_MASTER_PLAN.md. Should the token ledger upsert use `DO UPDATE` or `INSERT ... RETURNING`?"
3. **WOLF-1 will** clarify or update the plan doc. All decisions get documented.

### For Code Review / PR Issues
1. **Commit your work and open a PR** with a clear message:
   > "Phase 1: Add ensureBotBotSchema() and llmClient.ts

   > - Created botbot_model_config, botbot_conversations, botbot_messages, botbot_token_ledger, botbot_settings, botbot_usage tables
   > - Implemented callOllama() and callClaude() functions
   > - All env vars imported from runtimeConfig

   > Testing: Verified with curl that POST /api/botbot/models returns JSON"

2. **Wait for WOLF-1's review.** Do not merge your own PRs.
3. **If WOLF-1 requests changes:** Make them, re-push, re-request review. Don't make new PRs for the same work.

### For Blockers / Being Stuck
1. **30-minute rule:** If you're stuck for more than 30 minutes, ask. Not a sign of weakness.
2. **Message format:**
   > "Dev B here — stuck on useEffect dependencies in BotBotChatPanel. Messages aren't scrolling to bottom on new messages. ESLint is flagging missing deps. Can you help?"
3. **WOLF-1 will** pair with you or escalate to WOLF-2 (shift partner).

### For Shift Changes (WOLF-2 Takeover)
At the end of your shift, check `HANDOFF.md` in the project root. It will have:
- What was done today
- What's in progress and who owns it
- Blockers or decisions made
- What to focus on next

When WOLF-2 starts their shift, they read HANDOFF.md first.

---

## Git Workflow

### Branch Naming
- `botbot/dev-a/phase-1-schema`
- `botbot/dev-b/phase-2-orb`
- `botbot/dev-c/phase-3-admin`

### Commits
Write clear messages. Example:

```
Phase 1: Implement database schema for BotBot

- Add ensureBotBotSchema() to startupBootstrap.ts
- Create 6 tables: model_config, conversations, messages, token_ledger, settings, usage
- All tables use IF NOT EXISTS + ADD COLUMN IF NOT EXISTS pattern (idempotent)
- Seed model_config with Ollama local, Claude Haiku, Claude Sonnet
- All PKs, FKs, and indexes defined per BOTBOT_MASTER_PLAN.md

Tested: psql shows tables, SELECT * confirms 3 seed rows in model_config
```

### Code Style
- **No `any` in function signatures** — use proper types (Dev A can export type interfaces from llmClient.ts)
- **All DB queries parameterized** — `$1, $2` not string interpolation
- **No 400-line functions** — split into helpers
- **useEffect dependencies correct** — ESLint should pass
- **Comments only for "why", not "what"** — code should be self-explanatory

### Before Opening a PR
Run:
```bash
npm run test    # if you added tests
npm run build   # to catch TS errors
npm run lint    # if configured
```

---

## File Structure Reference

Keep this mentally mapped:

```
/home/alphahs/WOLF-FD/
├── BOTBOT_MASTER_PLAN.md          ← The spec
├── BOTBOT_QUESTIONS.md            ← FAQs + WOLF-1 decisions
├── DEVELOPER_ONBOARDING.md        ← You are here
├── HANDOFF.md                     ← Daily shift notes (created Phase 1)
├── App.tsx                        ← Dev B modifies (small)
├── types.ts                       ← Add BotBot types here (Dev B)
├── components/
│   └── botbot/                    ← All BotBot components
│       ├── BotBotOrb.tsx          (Dev B)
│       ├── BotBotChatPanel.tsx    (Dev B)
│       ├── BotBotContext.tsx      (Dev B)
│       ├── BotBotSettingsPanel.tsx (Dev C)
│       ├── BotBotAdminPanel.tsx   (Dev C)
│       └── index.ts               (Dev B — re-exports)
├── services/
│   └── botbotApi.ts               (Dev B)
└── pos-dashboard-backend/
    ├── package.json               (WOLF-1 adds @anthropic-ai/sdk)
    └── src/
        ├── runtimeConfig.ts       (WOLF-1 adds env vars)
        ├── routeWiring.ts         (WOLF-1 wires botbotRoutes)
        ├── startupBootstrap.ts    (Dev A adds ensureBotBotSchema)
        ├── llmClient.ts           (Dev A)
        ├── botbotPrompt.ts        (Dev A)
        └── routes/
            └── botbotRoutes.ts    (Dev A)
```

---

## Your First Week Checklist

- [ ] Read BOTBOT_MASTER_PLAN.md (all the way through)
- [ ] Read BOTBOT_QUESTIONS.md (understand the decisions)
- [ ] Read this file
- [ ] Introduce yourself to WOLF-1 (name, role, timezone, hours)
- [ ] Clone the repo and get the build running locally
- [ ] Ask a clarifying question (any dev) — get used to the workflow
- [ ] Complete your Phase 1 task
- [ ] Open a PR and get WOLF-1's approval
- [ ] Merge and celebrate

---

## Key Contacts

**WOLF-1 (Lead Programmer)**
- Final authority on all decisions
- Reviews all PRs before merge
- Resolves cross-dev conflicts
- Updates BOTBOT_MASTER_PLAN.md when decisions change

**WOLF-2 (Shift Partner)**
- Takes over when WOLF-1 is off
- Has same authority during their shift
- Leaves daily notes in HANDOFF.md

---

## Remember

1. **Quality over speed.** An extra hour to do it right beats three hours of rework.
2. **Ask questions.** The only bad question is the one that silently becomes a bug.
3. **Respect the existing codebase.** WolfBot.tsx stays untouched. Auth/nav logic stays intact.
4. **Commit messages matter.** Six months from now, someone will read what you wrote.
5. **Test your work before asking for review.** Curl tests for Dev A. Manual click-testing for Devs B and C.

---

**Welcome to the team. We're building something solid.**

WOLF-1
*Last updated: 2026-03-30*
