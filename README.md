<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18tsXpK9W67HG0rXwervEez8x6LSDicfQ

## Run Locally

**Prerequisites:**  Node.js

For the POS import + Postgres + API backend workflow, see `PROJECT_NOTES.md`.


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run with Docker

**Prerequisites:** Docker + Docker Compose

This will start the frontend (served by Nginx), the POS backend API, Postgres with the schema loaded, and Adminer (optional DB viewer).

1. Build and start the stack:
   `cp .env.example .env`
   `docker compose up --build`
2. Open the app:
   `http://localhost:8080`
3. (Optional) Open Adminer:
   `http://localhost:8081`

### Notes
- The frontend proxies `/api/*` to the backend container.
- Postgres data persists in a named Docker volume (`pos-postgres-data`).
- Uploaded POS files are stored in `pos-dashboard-backend/incoming/` on the host.
- Set `CORS_ORIGIN` if you need the backend to only allow specific frontend origins (comma-separated).
- Set `VITE_GEMINI_API_KEY` at build time if you want Gemini in the container build.
