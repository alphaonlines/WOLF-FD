# Agent Handoff Pointer

`AGENTS.md` is the canonical working guide for `/home/alphahs/WOLF-FD`. Read it first and keep it updated.

## Current Boundary

- This machine is to be treated as local-LLM infrastructure only.
- Do not configure cloud LLM provider keys, hosted-model credentials, or hosted-model fallback routes here unless Anthony explicitly requests that change.
- Prefer local/LAN runtimes such as Ollama for model availability, model selection, health checks, and token/cost tracking.
- If an LLM feature cannot run locally, report the missing local runtime/model instead of falling back to a hosted API.

## Current Operational Snapshot

- Repo: `/home/alphahs/WOLF-FD`
- Current branch: `botbot-tutorial-revive`
- Canonical guide: `/home/alphahs/WOLF-FD/AGENTS.md`
- Frontend: Vite + React + TypeScript, built to `dist/`
- Backend: Node.js + Express + TypeScript in `pos-dashboard-backend/`
- PM2 process: `pos-api`
- Live app: `https://furnituredistributors.wolf.discount/fd/`
- Live API path: `https://furnituredistributors.wolf.discount/fd/api/`
- Current display version as of this handoff: `0.5.1.2040`

## Maintenance Rule

Keep detailed history and running-task notes in `AGENTS.md`; keep this file as a compact pointer for agents that look for `@agents.md`.
