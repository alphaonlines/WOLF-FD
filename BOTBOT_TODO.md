# BotBot Implementation Guide

**Project**: BotBot - WOLF-FD Personal AI Assistant  
**Status**: In Progress  
**Lead Developer**: Team  

---

## Overview

BotBot is a lightweight AI assistant embedded across the WOLF-FD dashboard that guides first-time users through onboarding, remains persistently available across all pages, acts as a productivity assistant + morale companion, and supports milestone notifications and leaderboard engagement.

**IMPORTANT**: This is separate from the existing `WolfBot.tsx` component which manages Dialogflow call routing for business phone systems. BotBot is a personal user assistant.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WOLF-FD Frontend                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
│  │ BotBot      │  │ Page        │  │ BotBot Chat             ││
│  │ Orb         │◄─┤ Context     │◄─┤ Panel                  ││
│  │ Component   │  │ Provider    │  │                         ││
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘│
│         │                 │                      │               │
│         └─────────────────┼──────────────────────┘               │
│                           ▼                                      │
│                  services/botbotApi.ts                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      pos-api Backend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│
│  │ /botbot/    │  │ LLM         │  │ BotBot                  ││
│  │ chat        │─►│ Client      │  │ Scheduler               ││
│  │ endpoint    │  │ (Ollama/    │  │ (Milestones,            ││
│  └─────────────┘  │  OpenAI/    │  │  Ambient)               ││
│                   │  Claude)     │  └─────────────────────────┘│
│                   └─────────────┘                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL DB                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ botbot_settings│  │ botbot_usage    │  │ botbot_messages │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phases

### Phase 1: Core UI (Priority: HIGH)
**Goal**: Get the floating orb on screen and minimally functional

#### Task 1.1: Create BotBot Orb Component
**File**: `components/botbot/BotBotOrb.tsx` (NEW)

**Requirements**:
- Floating circular orb in bottom-right corner
- States: idle (subtle pulse), highlighting (glow), typing (bounce), notification (badge)
- Click expands to chat panel
- Minimizes to small orb
- Smooth animations (framer-motion)
- Respects dark/light mode

**Deliverable**: 
```tsx
// Usage in App.tsx
<BotBotOrb 
  isDarkMode={isDarkMode}
  onToggle={() => setBotBotOpen(!botBotOpen)}
  isExpanded={botBotOpen}
  hasNotification={hasNotification}
  assistantName={assistantName} // "BotBot" or custom
/>
```

#### Task 1.2: Create Chat Panel Component
**File**: `components/botbot/BotBotChatPanel.tsx` (NEW)

**Requirements**:
- Message history display
- Input field with send button
- Typing indicator
- Quick action buttons (optional)
- Close/minimize button
- Scroll to bottom on new messages
- Max height with scroll

**Deliverable**:
```tsx
<BotBotChatPanel
  messages={messages}
  onSend={handleSendMessage}
  onClose={() => setBotBotOpen(false)}
  isDarkMode={isDarkMode}
  assistantName={assistantName}
/>
```

#### Task 1.3: Add BotBot State to App.tsx
**Files to Modify**: `App.tsx`, `types.ts`

**Requirements**:
- Add `botBotOpen`, `setBotBotOpen` state
- Add `botBotMessages`, `setBotBotMessages` state
- Add `assistantName` from user settings
- Render BotBotOrb in fixed position (outside main content)
- Persist open/closed state in localStorage

**Deliverable**: Orb visible on all pages, persists across navigation

#### Task 1.4: Create BotBot API Service
**File**: `services/botbotApi.ts` (NEW)

**Requirements**:
```ts
// Endpoints to call
export async function sendBotBotMessage(message: string, pageContext: PageContext): Promise<BotBotResponse>
export async function getBotBotSettings(): Promise<BotBotSettings>
export async function updateBotBotSettings(settings: Partial<BotBotSettings>): Promise<void>
export async function getBotBotUsage(): Promise<BotBotUsage>
```

**Deliverable**: Frontend can send messages to backend

---

### Phase 2: Page Context System (Priority: HIGH)
**Goal**: BotBot knows what page user is on

#### Task 2.1: Define Page Context Type
**File**: `types.ts` (ADD)

**Requirements**:
```ts
type PageContext = {
  pageName: string;           // "Sales Dashboard", "CRM", "Den"
  module: string;             // "Pulse", "Den", "AMP", "Shop"
  userRole: string;           // "Owner", "Manager", "Sales", "Support"
  keyMetricsVisible: string[]; // ["totalSales", "pro1st", "units"]
  suggestedActions: string[];  // ["Create Promotion", "View Report"]
  currentRoute?: string;       // "/fd/sales", "/fd/crm"
};
```

#### Task 2.2: Create Context Provider
**File**: `components/botbot/BotBotContext.tsx` (NEW)

**Requirements**:
- React context to hold current page context
- `usePageContext()` hook for workspaces to update context
- Auto-detect page from active tab/state

**Deliverable**:
```tsx
const { pageContext, setPageContext } = useBotBotContext();

// In any workspace:
useEffect(() => {
  setPageContext({
    pageName: "Sales Dashboard",
    module: "Pulse",
    keyMetricsVisible: ["totalSales", "pro1st", "units"],
    suggestedActions: ["Print Report", "View Trends"]
  });
}, [activeTab]);
```

#### Task 2.3: Wire Context in All Workspaces
**Files to Modify**: Each workspace component

**Add page context setup in**:
- `SalesDashboard.tsx` - Sales metrics, report types
- `CRMWorkspace.tsx` - Customer count, queue size
- `WolfdenWorkspace.tsx` - Active tasks, message count
- `PulseWorkspace.tsx` - Current pulse tab
- `AmpWorkspace.tsx` - Social/AI tools status
- `ShopWorkspace.tsx` - Product search, catalogs
- `ProductSearchWorkspace.tsx` - Search results, cart
- `MessageBoard.tsx` - Channel list, unread
- `TaskManager.tsx` - Task counts by status

**Deliverable**: BotBot always knows current page

---

### Phase 3: AI Integration (Priority: HIGH)
**Goal**: BotBot can answer questions using AI

#### Task 3.1: Create Backend BotBot Routes
**File**: `pos-dashboard-backend/src/routes/botbotRoutes.ts` (NEW)

**Requirements**:
```ts
// POST /api/botbot/chat
interface ChatRequest {
  message: string;
  pageContext: PageContext;
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

interface ChatResponse {
  response: string;
  suggestions?: string[];
}
```

**Deliverable**: Endpoint accepts chat messages with context

#### Task 3.2: Create LLM Client
**File**: `pos-dashboard-backend/src/llmClient.ts` (NEW)

**Requirements**:
```ts
type LLMConfig = {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  baseURL?: string;  // For Ollama/custom
  apiKey?: string;  // For OpenAI/Anthropic
};

class LLMClient {
  async chat(prompt: string, context: PageContext): Promise<string>;
}
```

**Environment Variables**:
```env
# Primary: Local Ollama (free, fast)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Fallback: Remote API
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Or Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-haiku-20240307
```

**Deliverable**: Backend can call Ollama OR remote API

#### Task 3.3: Create Prompt Template
**File**: `pos-dashboard-backend/src/botbotPrompt.ts` (NEW)

**Requirements**:
```ts
function buildPrompt(message: string, context: PageContext, history: History[]): string {
  return `You are BotBot, the friendly WOLF-FD assistant.

User is currently on:
- Page: ${context.pageName}
- Module: ${context.module}
- Visible metrics: ${context.keyMetricsVisible.join(', ')}
- Suggested actions: ${context.suggestedActions.join(', ')}

${history.map(h => `${h.role}: ${h.content}`).join('\n')}

User: ${message}

Respond helpfully, positively, and concisely. Offer suggestions only if relevant.
Never interrupt active workflows.
Keep responses short (2-3 sentences max).`;
}
```

**Deliverable**: Context injected into every AI request

#### Task 3.4: Wire Frontend to Backend
**Files to Modify**: `services/botbotApi.ts`

**Requirements**:
- Call `POST /api/botbot/chat` on message send
- Show typing indicator while waiting
- Display response in chat
- Handle errors gracefully

**Deliverable**: Working AI chat

---

### Phase 4: Settings & Personalization (Priority: MEDIUM)
**Goal**: Users can customize their BotBot

#### Task 4.1: Create Database Tables
**File**: `pos-dashboard-backend/src/startupBootstrap.ts` (ADD)

**Requirements**:
```sql
CREATE TABLE botbot_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) UNIQUE,
  assistant_name VARCHAR(50) DEFAULT 'BotBot',
  assistant_theme VARCHAR(20) DEFAULT 'sky',  -- sky, emerald, violet, amber, rose, teal
  tutorial_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE botbot_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  session_start TIMESTAMP DEFAULT NOW(),
  session_minutes INTEGER DEFAULT 0,
  total_lifetime_minutes INTEGER DEFAULT 0,
  last_active TIMESTAMP DEFAULT NOW()
);
```

#### Task 4.2: Create Settings Endpoint
**Files**: `pos-dashboard-backend/src/routes/botbotRoutes.ts`

**Requirements**:
```ts
// GET /api/botbot/settings
// PUT /api/botbot/settings
// Body: { assistantName?: string; assistantTheme?: string; }
```

#### Task 4.3: Create Settings UI
**File**: `components/botbot/BotBotSettings.tsx` (NEW)

**Requirements**:
- Accessible from chat panel menu
- Change assistant name
- Choose color theme
- View usage stats
- Reset tutorial

**Deliverable**: Users can personalize BotBot

---

### Phase 5: Engagement System (Priority: MEDIUM)
**Goal**: BotBot interacts proactively

#### Task 5.1: Implement Usage Tracking
**Files**: `services/botbotApi.ts`, backend routes

**Requirements**:
- Track session start time
- Update `last_active` periodically (every minute)
- Calculate total lifetime minutes
- Return stats to frontend

#### Task 5.2: Create Milestone Messages
**Files**: `pos-dashboard-backend/src/botbotScheduler.ts` (NEW)

**Requirements**:
```ts
// Check for milestones after each user action
const milestones = [
  { hours: 1, message: "You've been working for 1 hour — great progress today! 🚀" },
  { hours: 5, message: "5 hours on the dashboard this week! You're crushing it! 💪" },
  { hours: 10, message: "10 hours total on WOLF-FD! Team hero right here! ⭐" },
];
```

**Trigger Conditions**:
- User idle for 5+ minutes (not interrupting)
- System load < 50%
- Not already shown this milestone

#### Task 5.3: Add Naming Flow
**Requirements**:
- After 5 hours total usage AND no custom name set
- BotBot asks: "We've been working together a while — would you like to give me a name?"
- Store custom name in botbot_settings

#### Task 5.4: Leaderboard System
**Requirements**:
```ts
// GET /api/botbot/leaderboard
interface LeaderboardEntry {
  userId: number;
  userName: string;
  weeklyMinutes: number;
  lifetimeMinutes: number;
  rank: number;
}
```

**BotBot mentions**:
- "You're ranked #3 in dashboard activity this week!"

---

### Phase 6: Message Board Integration (Priority: LOW)
**Goal**: BotBot exists in team messaging

#### Task 6.1: Add BotBot as System User
**Files**: `pos-dashboard-backend/src/routes/boardRoutes.ts`

**Requirements**:
- BotBot has special user type (system)
- Can post messages in any channel
- Has unique avatar/color

#### Task 6.2: Scheduled Tips
**Requirements**:
- BotBot occasionally posts in #general
- Tips based on time of day, recent activity
- Configurable frequency

---

## File Structure

```
/home/alphahs/WOLF-FD/
├── components/
│   └── botbot/
│       ├── BotBotOrb.tsx           # Floating orb component
│       ├── BotBotChatPanel.tsx     # Chat UI
│       ├── BotBotSettings.tsx      # Settings panel
│       ├── BotBotContext.tsx       # Page context provider
│       └── index.ts                # Exports
├── services/
│   └── botbotApi.ts               # Frontend API client
├── types.ts                       # ADD: PageContext, BotBotSettings, etc.
├── App.tsx                       # MODIFY: Add BotBot state and render
└── pos-dashboard-backend/
    └── src/
        ├── routes/
        │   └── botbotRoutes.ts    # Backend endpoints
        ├── llmClient.ts           # AI client (Ollama/OpenAI)
        ├── botbotPrompt.ts       # Prompt builder
        ├── botbotScheduler.ts    # Milestone scheduler
        └── startupBootstrap.ts   # ADD: DB tables
```

---

## Environment Variables

```env
# Backend (.env)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Optional: Remote fallback
# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4o-mini
# ANTHROPIC_API_KEY=
# ANTHROPIC_MODEL=claude-3-haiku-20240307

# Feature flags
BOTBOT_ENABLED=true
BOTBOT_LOCAL_FIRST=true  # Try local, fall back to remote
BOTBOT_AMBIENT_ENABLED=true
```

---

## Testing Checklist

- [ ] Orb appears on all pages
- [ ] Orb opens chat panel on click
- [ ] Messages send to backend
- [ ] AI responds with page-aware context
- [ ] Dark/light mode works
- [ ] Settings persist
- [ ] Usage tracking accurate
- [ ] Milestone messages appear
- [ ] Naming flow triggers at right time
- [ ] Leaderboard shows correct data

---

## Notes for Developers

1. **Ollama Setup**: If running locally, ensure Ollama is installed and model is pulled:
   ```bash
   ollama pull llama3.2
   ```

2. **Rate Limiting**: Consider adding rate limits to `/api/botbot/chat` to prevent abuse

3. **System Load**: Check `os.loadavg()` before triggering ambient BotBot interactions

4. **Security**: Never log or expose user's AI conversation history

5. **Existing WolfBot**: The `components/WolfBot.tsx` is for Dialogflow call routing - do NOT modify or delete it. It's unrelated to BotBot.

---

## Quick Start for New Developer

1. Read this entire file
2. Check `types.ts` for existing type patterns
3. Look at `services/authApi.ts` for API pattern
4. Start with Phase 1 (Core UI)
5. Test locally before deploying

---

*Last Updated: 2026-03-30*
