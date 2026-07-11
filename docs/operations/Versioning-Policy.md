---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard Versioning Policy

## Current Issue

Live static has been restored to `1.6.3.1554`, while repo metadata may still show older `1.5.28.1535` values. Treat this as a source/live mismatch until reconciled.

## Policy

- `package.json` must keep npm `version` semver-valid.
- UI/display version should be controlled by the project's established display-version mechanism.
- `public/smartcalc/version.json` must match the displayed version produced during build.
- Visible deploys should bump the display version using Anthony's timestamp style when appropriate.

## Anthony Timestamp Version Style

For WOLF-FD dashboard changes, bump the visible dashboard version on every change using:

- Display/UI version: `0.M.D.HHMM`
- Package/npm version: matching semver-safe prerelease `0.M.D-HHMM`
- The last four digits are the local 24-hour change time.

Example: July 4 at 11:48 = display `0.7.4.1148`, package `0.7.4-1148`.

## Required Checks

```bash
node -e "const p=require('./package.json'); console.log({version:p.version, displayVersion:p.displayVersion})"
cat public/smartcalc/version.json
npm run build
cat dist/smartcalc/version.json 2>/dev/null || true
```

After deploy:

```bash
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
```

## Marker Policy Beats Version Guessing

Version numbers are useful labels. Markers are physical evidence.

For Pulse Sales Analysis, deploy only if the bundle contains:

- `Finance Cost`
- `fd-sales-analysis-card-order`

For module routing preservation, deploy only if the bundle contains:

- `SHOP_CALCULATOR`
- `AMP_FDCONNECT`
- `AMP_KIOSKS`
