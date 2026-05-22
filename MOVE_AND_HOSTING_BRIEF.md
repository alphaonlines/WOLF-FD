# WOLF FD Dashboard: Move/Backup + Docker + Git Workflow

## What’s already in place

- `Dockerfile.frontend` (multi-stage Vite build + nginx)
- `Dockerfile.backend` (Node + Python importer + runtime)
- `docker-compose.yml` (Postgres + backend + frontend)
- `deploy.sh` (bootstrap + build + up + health checks)
- `DOCKER_DEPLOYMENT.md` (full usage notes)
- Git remote: `https://github.com/alphaonlines/WOLF-FD.git`

## Standard move procedure (for any host)

1. Clone the repo and check out the target branch:
   - `git clone https://github.com/alphaonlines/WOLF-FD.git`
   - `cd WOLF-FD`
   - `git checkout botbot-tutorial-revive`
2. Copy env sample values into `.env` and fill secrets:
   - `cp .env.production .env` (then edit)
3. Start the stack:
   - `./deploy.sh`
4. Verify:
   - Frontend: `http://<host>:8080`
   - API health: `http://<host>:5057/health`

## Notes for Alphahs2 website cutover

- The current canonical website homepage source on Alphahs2 lives in `/home/alphahs2/wolf_discount_work/wolf.discount.index.html`.
- `/srv/www/wolf.discount` is root-owned on Alphahs2, so production root deploy still requires an elevated copy step.

## Git safety for every move

- Never commit secrets.
- Keep `.env` out of Git.
- Commit only source changes and run:
  - `git add`
  - `git commit -m "..."`
  - `git push`
