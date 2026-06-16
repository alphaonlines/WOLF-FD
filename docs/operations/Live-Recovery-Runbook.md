---
Last Modified: 2026-06-06 21:50 -0400
Modified By: Mason S. Ives / gpt-5.5
Related Kanban: N/A
Project: WOLF FD Dashboard
Machine: AlphaHS
---

# WOLF FD Dashboard Live Recovery Runbook

## Purpose

Recover live FD static frontend from a known-good backup when live has regressed.

## Known Good Backup From 2026-06-06 Recovery

- Good static backup: `/home/alphahs/backups/fd-static-20260605-215740`
- Restored live version: `1.6.3.1554`
- Restored live asset: `assets/index-BqRqdO81.js`
- Live backup made before restore: `/home/alphahs/backups/wolf-fd-live-before-restore-20260606-213907`

## Select Backup By Markers

Before restore, prove the candidate backup has required markers:

```bash
python3 - <<'PYCHECK'
from pathlib import Path
src=Path('/home/alphahs/backups/fd-static-20260605-215740')
idx=(src/'index.html').read_text(errors='ignore')
asset=None
for part in idx.split('assets/')[1:]:
    if '.js' in part:
        asset=src/('assets/'+part.split('.js',1)[0]+'.js')
        break
if not asset or not asset.exists():
    raise SystemExit('backup asset not found')
data=asset.read_text(errors='ignore')
for m in ['Finance Cost','fd-sales-analysis-card-order','SHOP_CALCULATOR','AMP_FDCONNECT','AMP_KIOSKS']:
    print(m, data.count(m))
PYCHECK
```

## Restore Procedure

```bash
SRC=/home/alphahs/backups/fd-static-20260605-215740
DEST=/srv/www/wolf.discount/fd
STAMP=$(date +%Y%m%d-%H%M%S)
LIVE_BACKUP=/home/alphahs/backups/wolf-fd-live-before-restore-$STAMP
sudo mkdir -p "$LIVE_BACKUP"
sudo rsync -a "$DEST"/ "$LIVE_BACKUP"/
sudo rsync -a --delete "$SRC"/ "$DEST"/
sudo find "$DEST" -type d -exec chmod 755 {} +
sudo find "$DEST" -type f -exec chmod 644 {} +
echo "RESTORED_FROM=$SRC"
echo "LIVE_BACKUP=$LIVE_BACKUP"
```

## Public Verification

```bash
curl -sSI https://furnituredistributors.wolf.discount/fd/
curl -sS https://furnituredistributors.wolf.discount/fd/smartcalc/version.json
curl -sS https://furnituredistributors.wolf.discount/fd/api/health
```

Then download the public asset and count markers.

## Important Caution

Static restore fixes live immediately but does not reconcile editable source. After recovery, source must be repaired before the next normal build/deploy.
