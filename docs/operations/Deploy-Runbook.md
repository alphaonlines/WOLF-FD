---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard Deploy Runbook

## Purpose

Deploy WOLF FD Dashboard without overwriting working live features with older source.

## Frontend Deploy Preconditions

Do not deploy unless all are true:

1. `git status --short` has been reviewed.
2. Source version is intentional.
3. `npm run build` succeeds.
4. Built bundle contains required live markers.
5. Live static root has a fresh backup.

## Required Marker Check

```bash
cd /home/alphahs/WOLF-FD
npm run build
for m in "Finance Cost" "fd-sales-analysis-card-order" "SHOP_CALCULATOR" "AMP_FDCONNECT" "AMP_KIOSKS"; do
  grep -R "$m" dist/assets/*.js >/dev/null || { echo "Missing marker: $m"; exit 1; }
done
```

## Backup Live Static Root

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
sudo rsync -a /srv/www/wolf.discount/fd/ /home/alphahs/backups/wolf-fd-live-before-deploy-$STAMP/
echo /home/alphahs/backups/wolf-fd-live-before-deploy-$STAMP
```

## Deploy Frontend

```bash
sudo rsync -a --delete /home/alphahs/WOLF-FD/dist/ /srv/www/wolf.discount/fd/
sudo find /srv/www/wolf.discount/fd -type d -exec chmod 755 {} +
sudo find /srv/www/wolf.discount/fd -type f -exec chmod 644 {} +
```

## Public Verification

```bash
curl -sSI https://furnituredistributors.wolf.discount/fd/
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

Download the public asset and verify markers:

```bash
ASSET=$(python3 - <<'PYASSET'
from pathlib import Path
idx=Path('/srv/www/wolf.discount/fd/index.html').read_text(errors='ignore')
for part in idx.split('assets/')[1:]:
    if '.js' in part:
        print('assets/'+part.split('.js',1)[0]+'.js')
        break
PYASSET
)
curl -sS "https://furnituredistributors.wolf.discount/fd/$ASSET" -o /tmp/fd-live-asset.js
for m in "Finance Cost" "fd-sales-analysis-card-order" "SHOP_CALCULATOR" "AMP_FDCONNECT" "AMP_KIOSKS"; do
  printf "%s " "$m"; grep -oF "$m" /tmp/fd-live-asset.js | wc -l
done
```

## Backend Deploy Notes

If only backend files changed, do not deploy frontend.

Backend validation starts with:

```bash
cd /home/alphahs/WOLF-FD/pos-dashboard-backend
npm run test
npm run build
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

Restart method must be confirmed from current service ownership before use. Do not guess between PM2, Docker, and systemd.
