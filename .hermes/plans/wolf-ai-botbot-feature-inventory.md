# WOLF AI + BotBot Canonical Feature Inventory

| Feature | Source Today | Keep / Drop / Merge | Target API | Target UI Component |
|---|---|---|---|---|
| Public Learning Lab shell | `wolf.discount/ai` static app (`/home/alphahs/wolfbot-playground/public/index.html`, `styles.css`, `app.js`) | Keep visual style, port to React | n/a | `components/wolf-ai/WolfAiShell.tsx` |
| Playground composer | `wolf.discount/ai` static app | Keep look, replace engine | `POST /api/botbot/conversations`, `POST /api/botbot/messages` via `sendMessage()` | `components/wolf-ai/WolfAiComposer.tsx` |
| Conversations / New Chat | WOLF-FD BotBot | Keep canonical backend | `fetchConversations()`, `createConversation()`, `fetchMessages()` | `components/wolf-ai/WolfAiComposer.tsx` / later conversation rail |
| Message send | WOLF-FD BotBot | Keep canonical backend | `sendMessage()` | `WolfAiComposer` |
| Model picker | WOLF-FD BotBot + partial `/ai` model mode | Merge, WOLF-FD is canonical | `fetchBotBotModels()` | `WolfAiModelPill` / `WolfAiComposer` |
| Token limits | WOLF-FD BotBot | Keep canonical backend | `fetchTokenUsage()` | `WolfAiTokenPill`, `WolfAiTokenPanel` |
| Token usage tracking | WOLF-FD `botbot_token_ledger` + `/ai` bridge | Keep WOLF-FD as single writer; avoid double counting | canonical BotBot send path; external ledger only for legacy bridge | `WolfAiTokenPill` |
| Buy tokens | WOLF-FD BotBot token packs / Stripe | Keep canonical backend | `createBotBotTokenCheckout()` | `WolfAiTokenPanel` / existing `BotBotBuyTokensPage` |
| Settings | WOLF-FD BotBot | Keep logic, restyle | `fetchSettings()`, `saveSettings()`, `fetchRuntimeStatus()` | `WolfAiSettingsPanel` |
| Admin model/role/user quotas | WOLF-FD BotBot admin panel | Keep, owner/admin only | admin endpoints in `services/botbotApi.ts` | later `WolfAiAdminPanel` |
| Suggested prompt chips | WOLF-FD `PROMPT_CARDS`, `/ai` activities | Merge both sets | client-side prompt constants, optional systemPrompt through `sendMessage()` | `WolfAiPromptChips` |
| Follow-up prompts | WOLF-FD `FOLLOW_UP_PROMPTS` | Keep | client-side | `WolfAiPromptChips` |
| Page-aware context | WOLF-FD `BotBotContextProvider` | Keep inside dashboard; generic context on public `/ai` | `pageContext` passed to `sendMessage()` | `WolfAiComposer` |
| File upload | `/ai` has affordance and workspace upload; BotBot not fully surfaced | Keep button, wire later; disabled tooltip in first slice | TBD | `WolfAiComposer` |
| Microphone | `/ai` has visible affordance | Keep button as disabled/placeholder first slice | TBD | `WolfAiComposer` |
| Learning tabs | `/ai` static app | Keep shell/content as product education | local React content | `WolfAiLearningTabs` |
| Branding | Split: BotBot, WolfBot, Wolf Swarm AI | Merge public identity | n/a | `AI_BRAND` constants |

## Canonical Decisions

- Canonical backend: WOLF-FD `pos-dashboard-backend` BotBot APIs and PostgreSQL tables.
- Canonical public visual style: current `wolf.discount/ai` Learning Lab.
- Internal legacy name `botbot_*` may remain in API/table names until a later migration.
- Public UI should not present BotBot and WolfBot as two different assistants.
- OpenRouter provider auth remains a separate runtime issue (`401 User not found` currently observed) and must not block UI/backend merge validation.
