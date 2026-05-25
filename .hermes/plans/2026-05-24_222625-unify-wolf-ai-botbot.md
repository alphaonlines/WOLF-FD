# Unified Wolf AI + BotBot Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Merge the good-looking `wolf.discount/ai` WOLFbot Learning Lab / playground UI with the WOLF-FD BotBot/Wolf Swarm AI backend features: token limits, token ledger, model access control, settings, suggested click prompts, conversations, and admin controls.

**Architecture:** Use one canonical AI backend: the WOLF-FD `pos-dashboard-backend` BotBot APIs and database tables stay the source of truth for users, models, token quotas, usage, access rules, and settings. The `wolf.discount/ai` frontend keeps its warm Learning Lab / playground visual language, but its chat/settings/token UI should call the canonical BotBot APIs instead of running a parallel bot implementation. The dashboard orb can stay, but it should become another surface for the same assistant state, not a second product.

**Tech Stack:** React/Vite/Tailwind in `C:\Users\antho\WOLF-FD-git`, Express/TypeScript backend in `pos-dashboard-backend`, PostgreSQL BotBot tables, existing static/Node WOLFbot playground at `/home/alphahs/wolfbot-playground`, PM2 on AlphaHS `192.168.4.129`, public routes `https://furnituredistributors.wolf.discount/fd/` and `https://wolf.discount/ai/`.

---

## Confirmed Current Context

- `https://wolf.discount/ai/` is live and returns 200.
- `wolf.discount/ai` title is `WOLFbot Learning Lab`.
- Its visible style is worth preserving: warm ivory background, soft orange/green accents, centered playground composer, large prompt box, rounded pills, sidebar/nav, playful particle dots, model/status pills, New Chat, microphone/upload affordances.
- `wolf.discount/ai` currently lives on AlphaHS at `/home/alphahs/wolfbot-playground`.
- The WOLFbot playground is a separate Node app with files:
  - `/home/alphahs/wolfbot-playground/server.js`
  - `/home/alphahs/wolfbot-playground/public/index.html`
  - `/home/alphahs/wolfbot-playground/public/app.js`
  - `/home/alphahs/wolfbot-playground/public/styles.css`
  - `/home/alphahs/wolfbot-playground/public/workspace.html`
  - `/home/alphahs/wolfbot-playground/public/workspace-app.js`
  - `/home/alphahs/wolfbot-playground/public/workspace.css`
- WOLFbot playground already has partial token-bridge code in `server.js` using WOLF-FD external endpoints:
  - `POST /api/botbot/external/usage`
  - `POST /api/botbot/external/token-packs/checkout`
  - status/token ledger helpers in `server.js`
- WOLF-FD dashboard backend already has the stronger system:
  - `botbot_token_ledger`
  - `botbot_model_config`
  - `botbot_model_access`
  - `botbot_skill_access`
  - conversation/messages tables
  - settings table
  - admin model/role/user access panel
  - model catalog including local, OpenAI, OpenRouter, and Anthropic provider slots
- WOLF-FD React already has useful frontend surfaces:
  - `components/botbot/BotBotChatPanel.tsx`
  - `components/botbot/BotBotSettingsPanel.tsx`
  - `components/botbot/BotBotAdminPanel.tsx`
  - `components/botbot/BotBotBuyTokensPage.tsx`
  - `services/botbotApi.ts`
- BotBot already has clickable suggested prompt cards in `components/botbot/BotBotChatPanel.tsx`:
  - `PROMPT_CARDS`
  - `FOLLOW_UP_PROMPTS`
- WOLF-FD dashboard route currently requires Google sign-in; `/ai` has public/early-release behavior.
- OpenRouter model wiring exists, but current production OpenRouter key still returns `401 User not found`; do not confuse UI/backend unification with provider auth success.

## Product Decision

Canonical product name should become one thing. Recommended naming:

- Public product / route: `WOLF AI` or `WOLFbot`
- Assistant identity inside chat: user-configurable, default `WolfBot`
- Internal engine label: `Wolf Swarm AI`

Avoid showing both `BotBot` and `WolfBot` as separate assistants to users. That is the current two-bot smell. Tiny naming split, big UX fire.

## Proposed Target User Experience

1. User opens `https://wolf.discount/ai/`.
2. They see the current beautiful Learning Lab / Playground shell.
3. The playground composer uses the canonical BotBot backend for:
   - model list
   - token usage and limits
   - conversations
   - message send
   - usage ledger updates
   - settings
   - access rules
4. Suggested prompt chips appear under/near the composer:
   - page-aware prompts from WOLF-FD context where available
   - general Learning Lab prompts when public/no dashboard context exists
   - follow-up prompts after assistant replies
5. Settings open inside the same visual language, not a separate dark admin-looking panel.
6. Token usage is always visible as a compact pill and expandable ledger panel.
7. Admins/owners can still reach quota/model/user controls, but behind an owner/admin gate.
8. The existing `/fd` dashboard orb either:
   - uses the same shared components, or
   - links into `/ai` with the same authenticated session/user context.

## Migration Strategy

Do this as a bridge migration, not a rewrite.

- Phase 1: inventory and contracts.
- Phase 2: create a shared API/client contract.
- Phase 3: port the `/ai` visual components into React or wrap them carefully.
- Phase 4: replace duplicate `/ai` chat/token/model logic with canonical BotBot API calls.
- Phase 5: unify naming/routes.
- Phase 6: deploy with rollback.

Do not rip out the old playground server until `/ai` proves the new path can chat, track tokens, buy tokens, load settings, and start new conversations.

---

## Task 1: Freeze the Canonical Feature Inventory

**Objective:** List every feature that must survive the merge before moving code.

**Files:**
- Read: `components/botbot/BotBotChatPanel.tsx`
- Read: `components/botbot/BotBotSettingsPanel.tsx`
- Read: `components/botbot/BotBotAdminPanel.tsx`
- Read: `components/botbot/BotBotBuyTokensPage.tsx`
- Read: `services/botbotApi.ts`
- Read remote: `/home/alphahs/wolfbot-playground/public/index.html`
- Read remote: `/home/alphahs/wolfbot-playground/public/app.js`
- Read remote: `/home/alphahs/wolfbot-playground/public/workspace.html`
- Read remote: `/home/alphahs/wolfbot-playground/public/workspace-app.js`
- Create: `.hermes/plans/wolf-ai-botbot-feature-inventory.md`

**Steps:**
1. Create a feature matrix with columns: Feature, Source today, Keep/Drop/Merge, Target API, Target UI component.
2. Include at minimum:
   - chat send
   - conversations
   - new chat
   - suggested prompt chips
   - follow-up prompt chips
   - file upload/attachment
   - microphone button placeholder
   - model picker
   - token usage pill
   - token ledger panel
   - buy tokens
   - settings
   - admin model/role/user controls
   - learning modules: overview/timeline/courses/leaderboard/glossary
3. Mark `botbot_token_ledger` and BotBot APIs as canonical for billing and quota.
4. Mark `/ai` visual shell as canonical for public AI UX.

**Verification:**
- The inventory has no TBD for the features Anthony explicitly asked for: token limits, suggested prompts, settings.

---

## Task 2: Define One Naming Map

**Objective:** Remove the “two different bots” confusion in copy and UI labels.

**Files:**
- Modify: `constants.ts` or create `constants/aiBranding.ts`
- Modify later: `components/botbot/*`
- Modify later: `/home/alphahs/wolfbot-playground/public/*` or replacement React route

**Recommended constants:**

```ts
export const AI_BRAND = {
  productName: 'WOLF AI',
  assistantDefaultName: 'WolfBot',
  engineName: 'Wolf Swarm AI',
  poweredBy: 'Powered by Wolf Swarm AI',
};
```

**Steps:**
1. Decide final public labels before implementation.
2. Replace visible `BotBot` labels with `WolfBot` or user-configured assistant name.
3. Keep internal API/table names as `botbot_*` for now to avoid unnecessary migrations.
4. Add a comment explaining that `botbot_*` is legacy internal naming.

**Verification:**
- Public UI does not show two assistant identities on the same screen.
- API/database names still work without migration risk.

---

## Task 3: Add Shared Frontend API Client Methods for `/ai`

**Objective:** Make the good `/ai` UI able to consume canonical WOLF-FD BotBot data.

**Files:**
- Modify: `services/botbotApi.ts`
- Create or modify: `services/wolfAiApi.ts`
- Test: create `services/wolfAiApi.test.ts` if test setup supports it, otherwise add focused component tests later.

**API methods to expose/reuse:**
- `fetchBotBotModels()` -> model picker
- `fetchTokenUsage()` -> token ledger and token pill
- `fetchSettings()` -> assistant name/theme/default model
- `saveSettings()` -> settings panel
- `fetchConversations()` -> chat history
- `createConversation()` -> new chat
- `fetchMessages()` -> existing conversation messages
- `sendMessage()` -> assistant replies and token recording
- `createBotBotTokenCheckout()` -> buy tokens
- owner/admin APIs for quota controls when user role allows

**Steps:**
1. Keep API paths relative to the deployed `/fd/api` base when inside WOLF-FD.
2. For `/ai`, choose one of these approaches:
   - Preferred: serve the unified `/ai` app from the WOLF-FD Vite build and use the same `/fd/api` auth/session cookies.
   - Bridge option: keep WOLFbot playground Node server as a proxy to `/fd/api` temporarily.
3. Normalize response shapes so React components do not care whether they are rendered in `/fd` or `/ai`.

**Verification:**
- Unit tests mock API responses and confirm token/model/settings data maps correctly.
- No secret tokens are exposed to browser code.

---

## Task 4: Port the `/ai` Visual Shell into React

**Objective:** Preserve the awesome `wolf.discount/ai` look while moving it into the maintainable WOLF-FD React app.

**Files:**
- Create: `components/wolf-ai/WolfAiShell.tsx`
- Create: `components/wolf-ai/WolfAiPlayground.tsx`
- Create: `components/wolf-ai/WolfAiLearningTabs.tsx`
- Create: `components/wolf-ai/WolfAiParticles.tsx`
- Create: `components/wolf-ai/wolfAiTheme.ts`
- Optionally create: `components/wolf-ai/WolfAiShell.test.tsx`
- Source reference: `/home/alphahs/wolfbot-playground/public/index.html`
- Source reference: `/home/alphahs/wolfbot-playground/public/styles.css`
- Source reference: `/home/alphahs/wolfbot-playground/public/app.js`

**Steps:**
1. Recreate the layout in React:
   - sidebar
   - top nav tabs
   - light/live/dark controls
   - centered playground composer
   - footer
2. Use Tailwind classes where reasonable; keep exact CSS tokens in `wolfAiTheme.ts` if Tailwind gets ugly.
3. Preserve colors:
   - background ivory `#FFFCF7`
   - accent orange `#C9825C`
   - soft green `#8BA88A`
   - charcoal text `#3D3D38`
4. Recreate the particle dot background as a React component or CSS background.
5. Keep tabs:
   - Playground
   - Overview
   - Timeline
   - Courses
   - Leaderboard
   - Glossary

**Verification:**
- Browser screenshot of new React `/ai` page visually matches current `wolf.discount/ai` within reason.
- Mobile width still has usable nav/sidebar behavior.

---

## Task 5: Build the Unified Playground Composer

**Objective:** Replace duplicate `/ai` playground chat logic with canonical BotBot conversation/send logic.

**Files:**
- Create: `components/wolf-ai/WolfAiComposer.tsx`
- Create: `components/wolf-ai/WolfAiMessageList.tsx`
- Create: `components/wolf-ai/WolfAiModelPill.tsx`
- Create: `components/wolf-ai/WolfAiTokenPill.tsx`
- Modify/reuse logic from: `components/botbot/BotBotChatPanel.tsx`
- Modify/reuse API from: `services/botbotApi.ts`

**Behavior:**
1. Large prompt textarea placeholder: `Message WolfBot AI…`
2. Upload icon visible; if upload support is not wired in this pass, mark as disabled with tooltip `File context coming next`.
3. Microphone button visible; if not wired, mark as disabled or no-op with tooltip.
4. Send button calls canonical `sendMessage()`.
5. New Chat calls canonical `createConversation()` and clears current messages.
6. Model pill uses `fetchBotBotModels()`.
7. Token pill uses `fetchTokenUsage()`.
8. After sending, refresh token usage.

**Test:**
- Create `components/wolf-ai/WolfAiComposer.test.tsx`.
- Mock `sendMessage`, `fetchTokenUsage`, `fetchBotBotModels`, `createConversation`.

**Verification commands:**
```bash
npm exec vitest run components/wolf-ai/WolfAiComposer.test.tsx
npm run build
```

---

## Task 6: Add Suggested Prompt Chips

**Objective:** Give users clickable suggested prompts on the unified `/ai` page.

**Files:**
- Create: `components/wolf-ai/WolfAiPromptChips.tsx`
- Modify: `components/wolf-ai/WolfAiComposer.tsx`
- Extract/reuse from: `components/botbot/BotBotChatPanel.tsx` lines containing `PROMPT_CARDS` and `FOLLOW_UP_PROMPTS`
- Optional create: `constants/wolfAiPrompts.ts`

**Prompt groups:**
1. General Learning Lab prompts from current `/ai` activities:
   - Explain simply
   - Prompt upgrade
   - Compare answers
   - Build plan
2. BotBot operational prompts:
   - Explain this page
   - Coach my next step
   - Find risks
   - Handling objections
   - Read context
3. Follow-up chips after a reply:
   - Make that simpler.
   - Turn that into a checklist.
   - Give me the next 3 steps.
   - Write this as a message I can send.

**Behavior:**
- Clicking a chip should either:
  - fill the composer, or
  - send immediately if chip is explicitly marked `sendOnClick`.
- Default should fill the composer. Safer. Less accidental token burn.

**Test:**
- Clicking a chip populates the textarea.
- Follow-up chips appear after a mocked assistant response.

**Verification command:**
```bash
npm exec vitest run components/wolf-ai/WolfAiPromptChips.test.tsx components/wolf-ai/WolfAiComposer.test.tsx
```

---

## Task 7: Port Settings into the `/ai` Visual Language

**Objective:** Bring BotBot settings into the good `/ai` shell so users can change assistant name, model, theme, and onboarding without feeling like they opened a different product.

**Files:**
- Create: `components/wolf-ai/WolfAiSettingsPanel.tsx`
- Reuse logic from: `components/botbot/BotBotSettingsPanel.tsx`
- Modify: `components/wolf-ai/WolfAiShell.tsx`

**Settings to include:**
- Assistant name
- Theme/mood
- Default model
- Runtime endpoint status
- Credit summary
- Reset onboarding/tutorial

**Steps:**
1. Use the existing `fetchSettings`, `saveSettings`, `fetchRuntimeStatus`, `fetchTokenUsage` calls.
2. Render with the ivory/orange/green `wolf.discount/ai` visual language.
3. Keep owner/admin-only settings separate from normal user settings.

**Test:**
- Mock settings load.
- Change assistant name, blur input, assert `saveSettings({ assistantName })` called.
- Click model row, assert `saveSettings({ preferredModelKey })` called.

**Verification command:**
```bash
npm exec vitest run components/wolf-ai/WolfAiSettingsPanel.test.tsx
```

---

## Task 8: Add Admin Controls Behind Role Gate

**Objective:** Keep token/model/role management, but hide it from normal users.

**Files:**
- Create: `components/wolf-ai/WolfAiAdminPanel.tsx`
- Reuse logic from: `components/botbot/BotBotAdminPanel.tsx`
- Modify: `components/wolf-ai/WolfAiShell.tsx`

**Behavior:**
- If user roles include `Owner` or `Admin`, show Admin tab/button.
- Admin can view:
  - usage history
  - models and quotas
  - skills/tasks access
  - role access
  - user access/reset quota
- Normal users see none of this.

**Verification:**
- Owner mock sees Admin.
- Employee mock does not.
- Quota edit calls `patchAdminModelConfig`.

---

## Task 9: Decide Route Ownership for `/ai`

**Objective:** Stop serving two bot frontends long-term.

**Preferred route architecture:**
- WOLF-FD React app builds a standalone `/ai` route/page.
- Nginx serves `/ai/` from the WOLF-FD deployed `dist` or a copied `dist-ai` artifact.
- `/ai` calls `/fd/api/...` or `/ai/api/...` proxy endpoints that land on the same WOLF-FD backend.

**Bridge route architecture if needed:**
- Keep `/home/alphahs/wolfbot-playground/server.js` temporarily.
- Replace its chat/model/token implementations with proxy calls to WOLF-FD BotBot APIs.
- Keep only static shell serving and compatibility redirects.

**Files likely to change:**
- WOLF-FD: `App.tsx`
- WOLF-FD: routing/nav components
- WOLF-FD: `vite.config.ts` if base path needs adjustment
- WOLF-FD: deploy script or nginx config notes
- AlphaHS: `/home/alphahs/wolfbot-playground/server.js` only if bridge path is chosen
- AlphaHS nginx site config if `/ai` origin changes

**Recommendation:**
Use the WOLF-FD React app as the owner. The hardware reason is simple: one backend, one auth/session, one ledger. Two dashboards means two places for quota math to rust.

---

## Task 10: Auth and Public Access Model

**Objective:** Choose how public `/ai` users and WOLF-FD employees authenticate.

**Options:**
1. Employee-only first:
   - `/ai` requires WOLF-FD Google/session login.
   - Fastest and safest.
2. Hybrid public + employee:
   - anonymous users get limited free local/playground prompts
   - logged-in users get full ledger/settings/conversations
   - public traffic gets IP/device rate limits
3. Public full product:
   - requires account creation/token purchase flow
   - largest scope; do not do first.

**Recommendation for first merge:**
Hybrid public + employee, but implement employee-only first if time is tight.

**Backend concerns:**
- Public prompts need a separate anonymous quota table or strict IP throttle.
- Do not write anonymous usage into employee ledger without a real user key.
- Avoid exposing `BOTBOT_LEDGER_TOKEN` to browser code.

---

## Task 11: Token Ledger and Checkout Integration

**Objective:** Make the `/ai` token UI use the same ledger and checkout as WOLF-FD.

**Files:**
- Reuse: `components/botbot/BotBotBuyTokensPage.tsx`
- Create: `components/wolf-ai/WolfAiTokenPanel.tsx`
- Reuse backend: `pos-dashboard-backend/src/routes/botbotRoutes.ts`
- Reuse backend: `pos-dashboard-backend/src/routes/stripeTopupRoutes.ts`
- Reuse backend: `pos-dashboard-backend/src/routes/shopifyTopupRoutes.ts`

**Behavior:**
- Token pill always shows used / quota / remaining.
- Expanded panel shows per-model usage.
- Buy Tokens opens the existing Stripe Checkout path.
- Claim code redemption remains available if still needed.

**Verification:**
- API health returns 200.
- Token usage endpoint returns expected shape for authenticated user.
- Checkout creation returns Stripe URL when Stripe env is configured.
- OpenRouter key failure must be reported separately from checkout/token success.

---

## Task 12: Conversation and Memory Compatibility

**Objective:** Preserve useful existing `/ai` workspace memory/files without making them the billing source of truth.

**Files:**
- Read/possibly migrate from: `/home/alphahs/wolfbot-playground/server.js`
- Read/possibly migrate from workspace root under `/home/alphahs/wolfbot-playground` or configured workspace dirs
- WOLF-FD backend: add import script only if needed

**Steps:**
1. Inventory current `/ai` agent/message/memory storage.
2. Decide whether to migrate old messages or leave them as legacy archive.
3. If migrating, write a one-time script that maps old agent messages into BotBot conversation tables.
4. Do not migrate secrets or raw uploaded files blindly.

**Verification:**
- Legacy data either appears in the new conversation list or is clearly linked as archived.

---

## Task 13: Build Deployment and Rollback Plan

**Objective:** Ship without bricking either live AI surface.

**Files:**
- Modify: `deploy.sh` or create a dedicated AI deploy script
- Modify: docs/runbook, e.g. `WOLF_FD_MOVE_AND_VERIFY_RUNBOOK.md`
- Production paths:
  - `/srv/www/wolf.discount/fd`
  - `/srv/www/wolf.discount/AI` or `/srv/www/wolf.discount/ai` depending nginx case handling
  - `/home/alphahs/wolfbot-playground`

**Steps:**
1. Backup current `/ai` static/server files.
2. Backup current `/fd` static files.
3. Build WOLF-FD frontend.
4. Build WOLF-FD backend.
5. Deploy backend first.
6. Deploy `/ai` frontend second.
7. Keep old `/home/alphahs/wolfbot-playground` available for rollback until new `/ai` passes checks.

**Verification commands:**
```bash
npm exec vitest run components/wolf-ai/*.test.tsx components/botbot/BotBotBuyTokensPage.test.tsx
npm run build
cd pos-dashboard-backend && npm run build
curl -skS -o /dev/null -w 'ai:%{http_code}\n' https://wolf.discount/ai/
curl -skS -o /dev/null -w 'fd:%{http_code}\n' https://furnituredistributors.wolf.discount/fd/
curl -skS -o /dev/null -w 'health:%{http_code}\n' https://furnituredistributors.wolf.discount/fd/api/health
```

---

## Task 14: Production Acceptance Tests

**Objective:** Prove the merged product works from the browser, not just from build output.

**Manual/browser checks:**
1. Open `https://wolf.discount/ai/`.
2. Confirm the visual shell still looks like the current `/ai` page.
3. Confirm only one assistant identity is shown.
4. Click a suggested prompt chip; composer fills.
5. Send a prompt with a local model.
6. Confirm reply appears.
7. Confirm token usage updates.
8. Click New Chat; conversation resets/creates a new thread.
9. Open Settings; change assistant name; refresh; name persists.
10. Open model selector; select one enabled model; refresh; preference persists.
11. If Owner/Admin, open admin controls and confirm quota/model rows load.
12. Click Buy Tokens; Stripe flow starts or returns expected configuration warning.
13. Check OpenRouter model path separately; if key still returns `401 User not found`, report provider auth failure without calling the merge failed.

**Automated checks:**
- Component tests for prompt chips, settings, token pill, composer.
- Backend build.
- Frontend build.
- HTTP status checks for `/ai`, `/fd`, and health.

---

## Files Likely to Change

### WOLF-FD local repo: `C:\Users\antho\WOLF-FD-git`
- `App.tsx`
- `constants.ts` or new `constants/aiBranding.ts`
- `services/botbotApi.ts`
- new `services/wolfAiApi.ts`
- `components/botbot/BotBotChatPanel.tsx` only for extraction/shared logic
- `components/botbot/BotBotSettingsPanel.tsx` only for extraction/shared logic
- `components/botbot/BotBotAdminPanel.tsx` only for extraction/shared logic
- new `components/wolf-ai/WolfAiShell.tsx`
- new `components/wolf-ai/WolfAiPlayground.tsx`
- new `components/wolf-ai/WolfAiComposer.tsx`
- new `components/wolf-ai/WolfAiPromptChips.tsx`
- new `components/wolf-ai/WolfAiSettingsPanel.tsx`
- new `components/wolf-ai/WolfAiAdminPanel.tsx`
- new `components/wolf-ai/WolfAiTokenPanel.tsx`
- new tests under `components/wolf-ai/*.test.tsx`
- `pos-dashboard-backend/src/routes/botbotRoutes.ts` only if missing API contract for `/ai`
- `pos-dashboard-backend/src/runtimeConfig.ts` only if public/hybrid auth needs new env flags

### AlphaHS production / legacy app
- `/home/alphahs/wolfbot-playground/server.js` only during bridge/rollback phase
- `/home/alphahs/wolfbot-playground/public/*` only if not moving `/ai` fully into WOLF-FD yet
- nginx route config for `/ai` if route owner changes

---

## Risks and Tradeoffs

1. **Auth mismatch:** `/fd` is Google/session based; `/ai` has public/early-access behavior. Decide first-pass access model before coding.
2. **Provider auth:** OpenRouter UI can be correct while OpenRouter returns `401 User not found`. Keep provider validation separate.
3. **Double token counting:** If `/ai` keeps local ledger sync and canonical `sendMessage()` also logs usage, usage may count twice. One route should own usage writes.
4. **Static app vs React app:** Porting the beautiful static UI to React is extra work, but it prevents future split-brain bot drift.
5. **Dirty production trees:** Both WOLF-FD and wolfbot-playground have uncommitted changes on server. Back up before deploy. Do not `reset --hard` live trees without explicit approval.
6. **Case-sensitive `/AI` vs `/ai`:** Production has `/srv/www/wolf.discount/AI`, and the public route is `/ai/`. Verify nginx aliases before moving files.
7. **Public cost exposure:** If `/ai` remains public, enforce anonymous throttles before enabling paid cloud models.

---

## Recommended First Implementation Slice

Smallest useful merge:

1. Build React `WolfAiShell` matching current `/ai` look.
2. Embed canonical BotBot composer logic inside it.
3. Add prompt chips.
4. Add token pill + settings panel.
5. Keep admin panel reachable only for owners.
6. Deploy behind `/ai-next/` first.
7. Compare `/ai/` vs `/ai-next/` visually.
8. Cut `/ai/` over only after `/ai-next/` passes chat/token/settings checks.

This gives Anthony the pretty bodywork from `wolf.discount/ai` with the real drivetrain from BotBot. No twin-engine nonsense under the hood.
