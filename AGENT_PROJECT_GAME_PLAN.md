# Agent Project Game Plan

Updated: 2026-05-15 02:25 EDT
Repo: WOLF-FD

## Goal

Give Anthony's agents one repeatable operating system for working across WOLF-FD, WOLFbot, Smart Calc, Team Hub, and future projects without losing context, overwriting each other, or failing to back up work in progress.

The short version: GitHub is the durable source of truth for code. Team Hub is the cross-agent coordination board. Every project gets a small status file, every work session ends with a handoff, and every risky change gets a snapshot before the soldering iron touches the board.

## Operating Rules

1. Do not work from mystery folders.
   - Confirm repo root with `git rev-parse --show-toplevel`.
   - Confirm branch with `git status --short --branch`.
   - If `.git/HEAD` is missing or git metadata is broken, do not treat that folder as authoritative.

2. One task, one branch, one owner.
   - Branch format: `<area>/<agent-or-owner>/<short-task>`.
   - Examples:
     - `smartcalc/mason/tutorial-polish`
     - `botbot/cali/message-routing`
     - `infra/mason/backup-workflow`
     - `docs/cassandra/project-tracking`

3. No silent production deploys.
   - Build/test locally first.
   - Record the validation commands.
   - Ask Anthony before deploying customer-facing changes.

4. Secrets never go into repo notes.
   - Write `[REDACTED]` instead of keys, passwords, tokens, private URLs, or customer-private records.
   - Backups must exclude `.env`, credential files, private keys, and generated dependency folders unless Anthony explicitly says otherwise.

5. Every agent leaves a handoff.
   - If the task is not fully merged and deployed, the next agent should be able to resume from the handoff without psychic archaeology.

## Roles and lanes

These are default lanes, not prison walls. Specialists can disagree. That is useful.

- Mason: hardware, local AI/runtime limits, servers, deployment envelope, backups, diagnostics, Smart Calc first-pass validation.
- Cali/Callie: application code, UI, API, data flow, test architecture, automation.
- Cassandra: business priority, legal/risk, customer impact, product direction, project triage.
- Roger/Rockflow: mechanical/physical systems, field operations, practical hardware outside the laptop/server lane.
- WOLFbot/BotBot agents: project-specific app assistants. They should follow repo docs and escalate cross-project decisions.

When two agents disagree, document both reads under `Decision Notes` and let Anthony or the designated project lead choose. Do not bury the disagreement. That is how bugs grow mold.

## Project tracking model

Each active project should have exactly these lightweight records:

1. Project registry entry
   - Location: Team Hub project registry or repo root `PROJECTS.md` if the project has no hub yet.
   - Purpose: list the authoritative repo/folder, live URL, owner, backup path, and current status.

2. Project status note
   - Location: repo root `PROJECT_STATUS.md` or existing project-specific note if one already exists.
   - Purpose: current branch, current objective, blockers, next 3 actions, last verified test/build.

3. Handoff log
   - Location: repo root `HANDOFF.md` or `docs/handoffs/YYYY-MM-DD-<task>.md`.
   - Purpose: append-only shift/session notes.

4. Implementation plans
   - Location: `docs/plans/YYYY-MM-DD-<feature>.md`.
   - Purpose: exact implementation steps for agents.

5. GitHub issues or PRs
   - Purpose: work item tracking, review history, CI status, and merge record.

Do not create twelve competing TODO files for the same thing. That is not organization; that is confetti with timestamps.

## Project registry template

Use this shape for each project entry:

```markdown
## <Project Name>

- Status: active | paused | blocked | archived
- Lead agent/person: <name>
- Support agents: <names>
- GitHub repo: <owner>/<repo>
- Local working path: `<absolute path>`
- Server path: `<absolute path or n/a>`
- Live/staging URL: `<url or n/a>`
- Current branch: `<branch>`
- Current objective: <one sentence>
- Backup location: `<path or remote>`
- Last backup: <timestamp + backup id>
- Last validation: <commands + result>
- Next handoff file: `<path>`
- Risk notes: <secrets, deployment risk, data migration risk, customer-facing risk>
```

## Session start checklist for every agent

Run this before changing files:

```bash
git rev-parse --show-toplevel
git status --short --branch
git remote -v
git fetch origin
```

Then read, in order:

1. `@agents.md` if present.
2. `AGENTS.md` if present and safe to read.
3. `PROJECT_STATUS.md` or the closest project status note.
4. `HANDOFF.md` or the latest file under `docs/handoffs/`.
5. The issue/PR/plan for the current task.

For WOLF-FD Smart Calc specifically, current canonical local workspace is:

```text
C:\Users\antho\WOLF-FD-git
```

Use branch:

```text
botbot-tutorial-revive
```

Do not use these as authoritative without repairing or recloning first:

```text
C:\Users\antho\WOLF-FD\WOLF-FD
/home/alphahs2/WOLF-FD
```

Reason: the first is not the clean GitHub clone, and the second has broken git metadata as of this note.

## Work execution loop

1. Intake
   - Restate the user goal in one sentence.
   - Identify repo, branch, files, risk level, and validation commands.

2. Plan
   - For multi-step work, create or update `docs/plans/YYYY-MM-DD-<feature>.md`.
   - Tasks should be small enough that another agent can execute them without guessing.

3. Snapshot
   - Before destructive edits, migrations, bulk refactors, dependency upgrades, or deploy prep, create a backup snapshot.

4. Change
   - Use a feature branch unless Anthony explicitly wants a quick direct doc edit.
   - Prefer targeted patches over broad rewrites.

5. Verify
   - Run the smallest relevant test first.
   - Then run the project gate before handoff.
   - Record exact commands and PASS/FAIL.

6. Handoff
   - Update the status/handoff note.
   - Include changed files, branch, commit, tests, blockers, and next action.

7. PR / merge / deploy
   - Open PR when ready.
   - Do not merge or deploy customer-facing changes without approval unless Anthony has pre-authorized it for that task.

## Standard handoff template

```markdown
## YYYY-MM-DD HH:mm TZ — <Agent> — <Task>

### Goal
- <one sentence>

### Repo state
- Repo: `<path>`
- Branch: `<branch>`
- Commit: `<sha>`
- Dirty files: <none or list>

### Completed
- <bullet list>

### In progress
- Owner: <agent/person>
- Current file/function: `<path>` / `<symbol>`
- Next exact step: <command or edit>

### Validation
- `<command>` — PASS/FAIL
- `<command>` — PASS/FAIL

### Backup
- Snapshot id/path: `<path>`
- Restore command: `<command>`

### Blockers / decisions needed
- <bullet list or none>
```

## Backup strategy

There are three backup levels. Use the smallest level that actually protects the work.

### Level 1: Git safety branch

Use before normal feature work.

```bash
git status --short --branch
git checkout -b <area>/<agent>/<task>
git push -u origin HEAD
```

If already on a work branch, push it before risky edits:

```bash
git add <changed-files>
git commit -m "wip: checkpoint before <risk>"
git push
```

Use `wip:` only for temporary checkpoint commits on work branches. Squash or clean up before final merge if needed.

### Level 2: Local tracked-file archive

Use before large refactors, dependency churn, deploy packaging, or anytime git status is not clean and the agent is about to do something risky.

From repo root:

```bash
mkdir -p ../project-backups
stamp=$(date +%Y%m%d-%H%M%S)
repo=$(basename "$(pwd)")
git ls-files -z | tar --null -czf "../project-backups/${repo}-${stamp}-tracked.tar.gz" --files-from=-
sha256sum "../project-backups/${repo}-${stamp}-tracked.tar.gz"
```

This captures tracked files only. It intentionally excludes `.env`, `node_modules`, `dist`, `.git`, and local generated junk unless those files are tracked.

### Level 3: Full working snapshot with exclusions

Use before migrations, production deploys, broken repo repair, or when untracked work matters.

From the parent directory of the repo:

```bash
stamp=$(date +%Y%m%d-%H%M%S)
repo="WOLF-FD-git"
mkdir -p project-backups

tar -czf "project-backups/${repo}-${stamp}-working.tar.gz" \
  --exclude="${repo}/.git" \
  --exclude="${repo}/node_modules" \
  --exclude="${repo}/dist" \
  --exclude="${repo}/.env" \
  --exclude="${repo}/.env.*" \
  --exclude="${repo}/pos-dashboard-backend/.venv" \
  --exclude="${repo}/pos-dashboard-backend/node_modules" \
  "${repo}"

sha256sum "project-backups/${repo}-${stamp}-working.tar.gz"
```

If this backup might contain customer data, do not push it to GitHub. Store it only in the approved backup location and mark it private.

## Backup record template

Add this to the current handoff/status note after a backup:

```markdown
### Backup snapshot
- Time: YYYY-MM-DD HH:mm TZ
- Type: Level 1 | Level 2 | Level 3
- Path/branch: `<path-or-branch>`
- SHA-256: `<hash if archive>`
- Included: tracked files | working tree with exclusions | branch checkpoint
- Excluded: secrets, dependency folders, generated builds
- Restore tested: yes | no
```

## Restore drills

A backup that has never been tested is just a comforting lie in a tarball.

For archive snapshots:

```bash
mkdir -p /tmp/restore-test
cd /tmp/restore-test
tar -xzf /path/to/snapshot.tar.gz
```

Then run the smallest sanity check:

```bash
npm install
npm test
npm run build
```

For Git branches:

```bash
git fetch origin
git checkout <backup-or-work-branch>
git status --short --branch
```

## Cross-project coordination

When work crosses project boundaries, create a parent tracking note and link child work items.

Example:

```markdown
# Cross-project: Smart Calc + WOLFbot tutorial support

Parent objective: Make Smart Calc tutorial launchable from dashboard and explainable by BotBot.

Child work:
- WOLF-FD PR: <link>
- WOLFbot PR: <link>
- Team Hub note: <path/link>
- Deployment checklist: <path/link>

Integration risks:
- Message contract between iframe and parent
- Same-origin postMessage validation
- No overwrite of active quotes
- Local AI routing must stay local/LAN unless approved
```

Rules:

- The parent note owns cross-project status.
- Each repo owns its own code and tests.
- Do not copy secrets/configs between repos.
- Do not assume a deploy in one repo means the paired repo is deployed.

## Smart Calc current gate

For Smart Calc work in WOLF-FD, run these before saying the task is ready:

```bash
npm run test:smartcalc-tutorial
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm test
npm run build
```

Record warnings separately from failures. The current large Vite bundle warning is not itself a Smart Calc failure.

## GitHub issue labels

Recommended labels:

- `area:smartcalc`
- `area:botbot`
- `area:crm`
- `area:infra`
- `area:docs`
- `type:bug`
- `type:feature`
- `type:backup`
- `type:handoff`
- `risk:customer-facing`
- `risk:data-migration`
- `status:blocked`
- `status:needs-review`

## Definition of done

A task is done only when:

- The intended change is implemented.
- Tests/build relevant to the change pass.
- Git status is understood and clean or intentionally dirty with notes.
- Handoff/status note is updated.
- Backup exists if the work was risky or cross-project.
- PR is opened or Anthony explicitly chose local-only work.
- Deployment status is explicit: not deployed, staged, or deployed with approval.

No ghost work. No mystery folders. No unlabelled backups. No production button-mashing in the dark.
