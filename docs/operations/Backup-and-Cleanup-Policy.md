---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard Backup And Cleanup Policy

## Rule

Classify before moving. Backup before deleting. Never clean live state blind.

## Cleanup Buckets

- Active source: tracked frontend/backend files required to build the app.
- Runtime data: incoming POS files, processed files, uploads, media, generated social assets.
- Generated artifacts: `dist/`, backend `dist/`, `node_modules/`.
- Docs: root markdown files to move under `docs/` or archive with pointers.
- Backups: anything under `/home/alphahs/backups/`; do not delete during repo cleanup.
- Secrets: `.env*`, credentials, tokens; never copy values into docs.

## First-Pass Behavior

- Archive docs, do not delete them.
- Add `.gitignore` only after confirming tracked/untracked status.
- Do not move runtime upload/data directories without Anthony approval.
- Save manifests in `/home/alphahs/backups/wolf-fd-cleanup-checkpoint-*` before changes.

## Current Checkpoint Pattern

A cleanup checkpoint should include:

- `git-status-short.txt`
- `git-diff.patch`
- `git-diff-stat.txt`
- `git-stash-list.txt`
- `git-log-40.txt`
- `git-ls-files.txt`
- `file-manifest-maxdepth4.txt`
- package/version snapshots
- live route/version headers
