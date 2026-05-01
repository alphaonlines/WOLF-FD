# BotBot QA Test Plan - Phase 3

## Prerequisites
- Frontend: http://localhost:3000 (or your local dev URL)
- Backend: Running on port 5057
- Database: PostgreSQL with all BotBot tables initialized
- Browser: Chrome/Firefox with dev tools

## Test Cases

### 1. Authentication & Initial Load
- [ ] Open frontend, you should see login page
- [ ] Log in with test credentials
- [ ] After login, you should see BotBot orb in bottom-right corner
- [ ] First-time user should see tutorial prompt
- [ ] Tutorial can be skipped or started

### 2. Tutorial Flow (First-Time Users)
- [ ] Start tutorial
- [ ] Spotlight moves to menu at top-left with username greeting
- [ ] Can click menu to expand navigation
- [ ] Spotlight moves to left sidebar showing modules
- [ ] Can click "Pulse" tab to navigate to that module
- [ ] Spotlight highlights various page features as you navigate
- [ ] Tutorial explains theme toggle and BotBot position
- [ ] Final step shows pulsing BotBot icon
- [ ] Clicking BotBot icon completes tutorial and removes dark blur

### 3. Settings Panel - User Personalization
- [ ] Click BotBot orb in bottom-right → opens chat panel
- [ ] Look for settings icon/gear in BotBot chat header
- [ ] Settings panel should show:
  - [ ] Assistant name field (default: "BotBot")
  - [ ] Theme dropdown (light/dark/sky options)
  - [ ] Model preference selector (Ollama local / Claude API)
  - [ ] "Start Tutorial" button
- [ ] Change assistant name to "TestBot" → Save
- [ ] Reload page → name should persist as "TestBot"
- [ ] Change theme to "dark" → Save
- [ ] Reload page → theme should persist
- [ ] Change model preference → Save
- [ ] Reload page → model preference should persist

### 4. Admin Panel - Owner Only
- [ ] Log in as user with Owner role
- [ ] Click BotBot orb → open chat panel
- [ ] Look for admin icon in settings or main header
- [ ] Admin panel should show:
  - [ ] List of all users with their token usage
  - [ ] Per-user, per-model quota display
  - [ ] "Edit Quota" button for each user
  - [ ] "Reset Usage" button for each user
- [ ] Click "Edit Quota" for a test user
- [ ] Modal should show current quota and allow editing
- [ ] Change quota value → Save
- [ ] Quota should update immediately
- [ ] Click "Reset Usage" for a user
- [ ] Usage counter should reset to 0
- [ ] Verify in token ledger that reset was recorded

### 5. Page Context Updates
Navigate through workspaces and verify BotBot context updates:
- [ ] Go to Sales Analysis (Pulse) → BotBot context shows "Pulse" module
- [ ] Go to CRM → BotBot context shows "crm" module
- [ ] Go to Message Board → BotBot context shows "board" module
- [ ] Go to Wolfden > CRM tab → BotBot context shows "crm" module
- [ ] Go to Shop > Product Search → BotBot context shows "product_search" module
- [ ] Go to Task Manager → BotBot context shows "tasks" module
- [ ] Open browser dev tools Console → no auth errors

### 6. Chat - End-to-End Message Flow
- [ ] Open BotBot chat panel
- [ ] Start new conversation (or select existing)
- [ ] Select Ollama (local model) as AI model
- [ ] Type a simple message: "Hi, what is furniture?"
- [ ] Click Send
- [ ] Message appears in chat with user role
- [ ] Waiting indicator shows while model responds
- [ ] Response appears with assistant role
- [ ] Token usage updates in token meter
- [ ] Token count increases appropriately
- [ ] Chat is saved in conversations list (reload page → conversation persists)

### 7. Token Quota System
- [ ] Set a low token quota (e.g., 50 tokens) on a test user
- [ ] Log in as that user
- [ ] Send multiple messages until quota is exhausted
- [ ] When quota exceeded:
  - [ ] Next message submission should show error or 402 response
  - [ ] Banner should appear: "Quota Exceeded - Contact admin"
  - [ ] Chat input should be disabled
  - [ ] Message should NOT be sent
- [ ] Log in as admin
- [ ] Reset user quota in admin panel
- [ ] Log back in as test user
- [ ] Chat should work again
- [ ] New message can be sent

### 8. Model Switching
- [ ] In chat, switch model from "Ollama (Local)" to "Claude API"
- [ ] Send a message
- [ ] Model switch should work (if Claude API is configured)
- [ ] Token tracking should credit/debit appropriate model
- [ ] Admin panel should show separate quotas per model

### 9. Conversation Management
- [ ] Create conversation 1: "About Furniture"
- [ ] Send 3 messages in conversation 1
- [ ] Create conversation 2: "Pricing Question"
- [ ] Send 2 messages in conversation 2
- [ ] Switch back to conversation 1
- [ ] Conversation 1 history should show all 3 messages
- [ ] Delete conversation 1
- [ ] Conversation should disappear from list
- [ ] Conversation 2 should still exist with 2 messages

### 10. Context-Aware Assistant
- [ ] Navigate to Sales Analysis page
- [ ] Open BotBot chat
- [ ] Context should include: page=Sales Analysis, module=pulse
- [ ] Send: "What page am I on?"
- [ ] Assistant response should reference Pulse/Sales Analysis
- [ ] Navigate to CRM page
- [ ] Send: "What page am I on?"
- [ ] Assistant response should reference CRM

## Issues to Watch For
- [ ] Auth token missing/expired → check browser cookies
- [ ] Chat not appearing → check that BotBot component mounted
- [ ] Settings not saving → check Network tab for API errors
- [ ] Token not updating → verify botbot_token_ledger table is being written
- [ ] Quota not enforcing → check 402 response handling in frontend
- [ ] Context not updating → verify setPageContext() calls in workspace components
- [ ] Spotlight not transitioning → check Framer Motion in BotBotTutorial

## Logs to Check
Backend: `pm2 logs pos-api`
Frontend: Browser dev tools Console tab
Database: `SELECT * FROM botbot_token_ledger ORDER BY created_at DESC LIMIT 10;`

## Success Criteria
✅ All 10 test cases pass
✅ No errors in console
✅ No unhandled promise rejections
✅ Token tracking is accurate
✅ Settings persist across sessions
✅ First-time tutorial displays correctly
✅ Admin quota management works as expected
