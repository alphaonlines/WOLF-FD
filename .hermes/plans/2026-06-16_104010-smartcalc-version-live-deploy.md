# Smart Calc Version Live Deployment Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Safely take the already-prepared Smart Calc version bump from `1.6.4.1616` to `1.6.16.1036` live without redeploying the full FD dashboard bundle.

**Architecture:** Smart Calc’s visible version is sourced from `package.json` `displayVersion`, then synchronized into static Smart Calc files by `scripts/sync-smartcalc-version.cjs`. A Vite build copies those static files into `dist/`, and production can be updated by replacing only the Smart Calc static artifacts under `/srv/www/wolf.discount/fd/`.

**Tech Stack:** WOLF-FD static frontend, Vite, npm scripts, standalone Smart Calc HTML, nginx-served static production root at `/srv/www/wolf.discount/fd/`.

---

## Current Context / Assumptions

- Repo: `/home/alphahs/WOLF-FD`
- Live Smart Calc URL: `https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html`
- Live version endpoint: `https://furnituredistributors.wolf.discount/fd/smartcalc/version.json`
- Current live version before deploy: `1.6.4.1616`
- Prepared target version: `1.6.16.1036`
- Source changes already prepared in the working tree:
  - `package.json`
  - `public/smartcalc/index.html`
  - `public/smartcalc/version.json`
  - `public/tools/smart-pricing-calculator.html`
  - `scripts/smartcalc-tutorial-smoke.cjs`
- Smart Calc-specific validation already passed once:
  - `npm run build`
  - required deploy marker checks
  - `npm run test:smartcalc-margin-discounts`
  - `npm run test:smartcalc-number-input-wheel`
  - `npm run test:smartcalc-tutorial`
- Full Vitest suite currently has unrelated Competitor Pricing failures. Because of that, do **not** deploy the full dashboard `dist/` bundle for this version-only Smart Calc change.
- Production writes require explicit Anthony approval before running backup/deploy commands.

---

## Proposed Approach

1. Reconfirm the working tree only contains the intended Smart Calc/version/test-smoke edits plus known unrelated untracked backend data.
2. Re-run the focused Smart Calc build and validation gates.
3. Stop for explicit approval before any production write.
4. Back up the full live FD static root.
5. Deploy only these three verified Smart Calc static artifacts from `dist/`:
   - `dist/tools/smart-pricing-calculator.html`
   - `dist/smartcalc/index.html`
   - `dist/smartcalc/version.json`
6. Verify live endpoint and rendered DOM show `1.6.16.1036`.
7. If live verification fails, restore only the three files from the backup or restore the full backup if necessary.

---

## Step-by-Step Plan

### Task 1: Reconfirm repo status and intended diff

**Objective:** Make sure no unrelated source edits are accidentally included in the Smart Calc deploy.

**Files:**
- Inspect: `/home/alphahs/WOLF-FD/package.json`
- Inspect: `/home/alphahs/WOLF-FD/public/smartcalc/index.html`
- Inspect: `/home/alphahs/WOLF-FD/public/smartcalc/version.json`
- Inspect: `/home/alphahs/WOLF-FD/public/tools/smart-pricing-calculator.html`
- Inspect: `/home/alphahs/WOLF-FD/scripts/smartcalc-tutorial-smoke.cjs`

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
git status --short --branch
git diff --name-only
git diff --stat
```

**Expected:**

```text
## cleanup/wolf-fd-source-reconcile-20260606-215228
 M package.json
 M public/smartcalc/index.html
 M public/smartcalc/version.json
 M public/tools/smart-pricing-calculator.html
 M scripts/smartcalc-tutorial-smoke.cjs
?? pos-dashboard-backend/data/
```

If additional tracked files appear, stop and inspect before continuing.

---

### Task 2: Reconfirm version metadata in source

**Objective:** Verify source metadata still points to the intended version before rebuilding.

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
node -e "const p=require('./package.json'); console.log(JSON.stringify({version:p.version,displayVersion:p.displayVersion},null,2))"
cat public/smartcalc/version.json
grep -Eo 'data-smart-calc-version="[^"]+"|Smart Calc v[0-9][^<]*' public/tools/smart-pricing-calculator.html | head -5
grep -Eo 'Furniture Distributors pricing tool · v[0-9][^<]*|smart-pricing-calculator.html\?v=[^"]+' public/smartcalc/index.html | head -5
```

**Expected key values:**

```text
"displayVersion": "1.6.16.1036"
"version": "1.6.16.1036"
data-smart-calc-version="1.6.16.1036"
Smart Calc v1.6.16.1036
Furniture Distributors pricing tool · v1.6.16.1036
smart-pricing-calculator.html?v=1.6.16.1036
```

---

### Task 3: Build verified static artifacts

**Objective:** Generate `dist/` artifacts from the current versioned source.

**Command:**

```bash
cd /home/alphahs/WOLF-FD
npm run build
```

**Expected:**

```text
Smart Calc version synced to 1.6.16.1036
✓ built in ...
```

Warnings about `NODE_ENV=production`, old Browserslist data, dynamic import chunking, or large chunks are currently known Vite warnings. They are not blockers for this targeted static Smart Calc deploy unless the build exits nonzero.

---

### Task 4: Verify `dist/` Smart Calc version and required deploy markers

**Objective:** Prove the build contains the new Smart Calc version and preserves required FD dashboard markers before any production write.

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
cat dist/smartcalc/version.json
grep -Eo 'data-smart-calc-version="[^"]+"|Smart Calc v[0-9][^<]*' dist/tools/smart-pricing-calculator.html | head -5
for m in "Finance Cost" "fd-sales-analysis-card-order" "SHOP_CALCULATOR" "AMP_FDCONNECT" "AMP_KIOSKS" "Competitor Pricing" "Write to Google Sheet"; do
  grep -R "$m" dist/assets/*.js >/dev/null || { echo "Missing marker: $m"; exit 1; }
  echo "OK marker: $m"
done
git diff --check
```

**Expected:**

```text
"version": "1.6.16.1036"
"displayVersion": "1.6.16.1036"
data-smart-calc-version="1.6.16.1036"
Smart Calc v1.6.16.1036
OK marker: Finance Cost
OK marker: fd-sales-analysis-card-order
OK marker: SHOP_CALCULATOR
OK marker: AMP_FDCONNECT
OK marker: AMP_KIOSKS
OK marker: Competitor Pricing
OK marker: Write to Google Sheet
```

If any marker is missing, stop. Do not deploy.

---

### Task 5: Run focused Smart Calc smoke tests

**Objective:** Verify the standalone Smart Calc behaviors touched by this area still pass.

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm run test:smartcalc-tutorial
```

**Expected:**

```text
Smart Calc margin discount smoke PASS
Smart Calc number input wheel smoke PASS
Smart Calc tutorial smoke PASS
```

Do not require the full `npm run test -- --run` suite to pass for this targeted deployment, because the current full suite has unrelated Competitor Pricing failures. Record that limitation in the final report.

---

### Task 6: Approval gate before production write

**Objective:** Obtain explicit approval from Anthony before modifying `/srv/www/wolf.discount/fd/`.

**Message to Anthony:**

```text
Ready for targeted Smart Calc live deploy.
This will back up /srv/www/wolf.discount/fd/ and replace only:
- /srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html
- /srv/www/wolf.discount/fd/smartcalc/index.html
- /srv/www/wolf.discount/fd/smartcalc/version.json
Approve?
```

**Expected:** Anthony explicitly approves the targeted deploy.

If approval is denied or unclear, stop.

---

### Task 7: Back up live static root

**Objective:** Create a recovery point before any production file replacement.

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP=/home/alphahs/backups/wolf-fd-live-before-smartcalc-version-$STAMP
sudo rsync -a /srv/www/wolf.discount/fd/ "$BACKUP/"
printf 'backup=%s\n' "$BACKUP"
```

**Expected:**

```text
backup=/home/alphahs/backups/wolf-fd-live-before-smartcalc-version-YYYYMMDD-HHMMSS
```

Keep this backup path for rollback and final reporting.

---

### Task 8: Deploy only Smart Calc static artifacts

**Objective:** Update live Smart Calc version without replacing the main dashboard bundle.

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
sudo install -D -m 0644 dist/tools/smart-pricing-calculator.html /srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html
sudo install -D -m 0644 dist/smartcalc/index.html /srv/www/wolf.discount/fd/smartcalc/index.html
sudo install -D -m 0644 dist/smartcalc/version.json /srv/www/wolf.discount/fd/smartcalc/version.json
```

**Expected:** no output and exit code `0`.

Do not run `sudo rsync -a --delete dist/ /srv/www/wolf.discount/fd/` for this targeted version-only deploy, because that would replace the whole app bundle despite unrelated full-suite test failures.

---

### Task 9: Verify live files on disk

**Objective:** Confirm the production files on disk show the target version.

**Commands:**

```bash
grep -Eo 'data-smart-calc-version="[^"]+"|Smart Calc v[0-9][^<]*' /srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html | head -5
cat /srv/www/wolf.discount/fd/smartcalc/version.json
```

**Expected:**

```text
data-smart-calc-version="1.6.16.1036"
Smart Calc v1.6.16.1036
"version": "1.6.16.1036"
"displayVersion": "1.6.16.1036"
```

---

### Task 10: Verify live HTTP endpoint and page HTML

**Objective:** Confirm nginx-served production content is updated externally.

**Commands:**

```bash
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html | grep -Eio 'data-smart-calc-version="[^"]+"|Smart Calc v[0-9][^<]*' | head -5
curl -sS -o /dev/null -w 'Smart Calc page HTTP %{http_code} bytes %{size_download}\n' https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html
curl -sS -o /dev/null -w 'Smart Calc wrapper HTTP %{http_code} bytes %{size_download}\n' https://furnituredistributors.wolf.discount/fd/smartcalc/
```

**Expected:**

```text
"version": "1.6.16.1036"
"displayVersion": "1.6.16.1036"
data-smart-calc-version="1.6.16.1036"
Smart Calc v1.6.16.1036
Smart Calc page HTTP 200 bytes ...
Smart Calc wrapper HTTP 200 bytes ...
```

---

### Task 11: Verify rendered browser DOM

**Objective:** Confirm the user-visible rendered Smart Calc page displays the target version, not just the raw HTML.

**Browser check:**

Open:

```text
https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html
```

Evaluate:

```js
(() => document.body.innerText.split('\n').map(s => s.trim()).filter(Boolean).filter(l => /SMART CALC V/i.test(l)))()
```

**Expected:**

```text
SMART CALC V1.6.16.1036
```

---

### Task 12: Optional source control checkpoint

**Objective:** Create a source checkpoint only if Anthony wants this repo state committed.

**Files:**
- `package.json`
- `public/smartcalc/index.html`
- `public/smartcalc/version.json`
- `public/tools/smart-pricing-calculator.html`
- `scripts/smartcalc-tutorial-smoke.cjs`

**Commands:**

```bash
cd /home/alphahs/WOLF-FD
git add package.json public/smartcalc/index.html public/smartcalc/version.json public/tools/smart-pricing-calculator.html scripts/smartcalc-tutorial-smoke.cjs
git commit -m "chore: bump Smart Calc display version"
```

**Expected:** commit succeeds.

Do not include `pos-dashboard-backend/data/` unless Anthony separately scopes that data path.

---

## Rollback Plan

Use the backup path printed in Task 7.

### Targeted rollback

```bash
BACKUP=/home/alphahs/backups/wolf-fd-live-before-smartcalc-version-YYYYMMDD-HHMMSS
sudo install -D -m 0644 "$BACKUP/tools/smart-pricing-calculator.html" /srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html
sudo install -D -m 0644 "$BACKUP/smartcalc/index.html" /srv/www/wolf.discount/fd/smartcalc/index.html
sudo install -D -m 0644 "$BACKUP/smartcalc/version.json" /srv/www/wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
```

### Full static-root rollback, only if necessary

```bash
BACKUP=/home/alphahs/backups/wolf-fd-live-before-smartcalc-version-YYYYMMDD-HHMMSS
sudo rsync -a --delete "$BACKUP/" /srv/www/wolf.discount/fd/
```

Full rollback is broader and should only be used if targeted rollback fails or additional accidental changes are discovered.

---

## Files Likely To Change / Deploy

### Source files already modified

- `/home/alphahs/WOLF-FD/package.json`
- `/home/alphahs/WOLF-FD/public/smartcalc/index.html`
- `/home/alphahs/WOLF-FD/public/smartcalc/version.json`
- `/home/alphahs/WOLF-FD/public/tools/smart-pricing-calculator.html`
- `/home/alphahs/WOLF-FD/scripts/smartcalc-tutorial-smoke.cjs`

### Production files to replace after approval

- `/srv/www/wolf.discount/fd/tools/smart-pricing-calculator.html`
- `/srv/www/wolf.discount/fd/smartcalc/index.html`
- `/srv/www/wolf.discount/fd/smartcalc/version.json`

---

## Tests / Validation Summary

Run before deploy:

```bash
cd /home/alphahs/WOLF-FD
npm run build
npm run test:smartcalc-margin-discounts
npm run test:smartcalc-number-input-wheel
npm run test:smartcalc-tutorial
git diff --check
```

Run after deploy:

```bash
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html | grep -Eio 'data-smart-calc-version="[^"]+"|Smart Calc v[0-9][^<]*' | head -5
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' https://furnituredistributors.wolf.discount/fd/tools/smart-pricing-calculator.html
```

Known limitation:

```bash
npm run test -- --run
```

currently fails in unrelated `components/CompetitorPricingWorkspace.test.tsx` cases. Do not hide this; report it as unrelated existing test debt unless it changes after this work.

---

## Risks, Tradeoffs, and Open Questions

### Risks

- Production static writes can affect the live FD dashboard path if the wrong command or target path is used.
- Browser/CDN/cache behavior could temporarily show the old Smart Calc page even after files are replaced. The version query string in `smartcalc/index.html` and updated manifest help bust iframe caching.
- Full test suite failure means a full bundle deploy would be risky; keep this to the three Smart Calc files only.

### Tradeoffs

- Targeted deploy minimizes blast radius but leaves the main dashboard bundle unchanged.
- Fixing the stale Smart Calc tutorial smoke assertion is included because it validates current production copy (`WOLFbot assistant`) instead of an outdated `BotBot` string.

### Open Questions

- Should the source changes be committed after live verification, or left as working tree changes for Anthony to review?
- Should the unrelated Competitor Pricing test failures be handled in a separate follow-up task?
