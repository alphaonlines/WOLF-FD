# WOLF root homepage content layer

This directory is the source-controlled content contract for the root `wolf.discount` homepage redesign. It keeps editorial structure, SEO metadata, asset paths, and deployment constraints separate from the FD dashboard app.

## Files

- `homepage.content.json` - structured copy, navigation, CTA, SEO/OpenGraph metadata, destination links, and route constraints.
- `assets.manifest.json` - copied/generated asset inventory with byte counts and SHA-256 hashes for deployment verification.
- `../public/assets/videos/wolf-dashboard-signup.mp4` - copied dashboard signup video used by the current staged homepage path `/assets/videos/wolf-dashboard-signup.mp4`.
- `../public/assets/brand/wolf-favicon.svg` - dependency-free SVG favicon for the root homepage.
- `../public/assets/brand/wolf-og-card.svg` - dependency-free SVG OpenGraph/social preview card.
- `../public/robots.txt` and `../public/sitemap.xml` - root static SEO files for the cutover package.

## Route and cache rules

- Preserve `/fd/` and `/fd/api/` behavior. This task only prepares root homepage content/assets.
- Keep `/assets/videos/wolf-dashboard-signup.mp4` stable so existing cached references continue to work gracefully.
- Put new root brand/meta files under `/assets/brand/` to avoid collisions with existing Vite hashed `/fd/assets/*` files.
- Do not deploy these files into `/srv/www/wolf.discount` until the homepage template and cutover checklist cards are reviewed.

## Verification

Run from repo root:

```bash
python3 -m json.tool website-content/homepage.content.json >/dev/null
python3 -m json.tool website-content/assets.manifest.json >/dev/null
python3 - <<'PY'
from pathlib import Path
for p in ['public/assets/videos/wolf-dashboard-signup.mp4','public/assets/brand/wolf-favicon.svg','public/assets/brand/wolf-og-card.svg','public/robots.txt','public/sitemap.xml']:
    assert Path(p).exists(), p
print('homepage content assets present')
PY
```
