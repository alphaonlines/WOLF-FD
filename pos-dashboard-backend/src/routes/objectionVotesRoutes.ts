import type { Express } from "express";
import type { Pool } from "pg";

export function registerObjectionVotesRoutes(app: Express, pool: Pool) {
  // Ensure table exists
  pool.query(`
    CREATE TABLE IF NOT EXISTS objection_votes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      objection_id TEXT NOT NULL,
      rebuttal_index INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, objection_id)
    )
  `).catch(() => {});

  // GET /api/objection-votes — aggregated vote counts + current user's votes
  app.get("/api/objection-votes", async (req, res) => {
    const user = (req as any).authUser;
    const userId = user ? Number(user.id) : null;

    const countsResult = await pool.query(
      `SELECT objection_id, rebuttal_index, COUNT(*)::int AS count
       FROM objection_votes
       GROUP BY objection_id, rebuttal_index`
    ).catch(() => ({ rows: [] as any[] }));

    const userVotesResult = userId
      ? await pool.query(
          `SELECT objection_id, rebuttal_index FROM objection_votes WHERE user_id = $1`,
          [userId]
        ).catch(() => ({ rows: [] as any[] }))
      : { rows: [] as any[] };

    // votes: { [objectionId]: { [rebuttalIndex]: count } }
    const votes: Record<string, Record<number, number>> = {};
    for (const row of countsResult.rows) {
      if (!votes[row.objection_id]) votes[row.objection_id] = {};
      votes[row.objection_id][Number(row.rebuttal_index)] = Number(row.count);
    }

    // userVotes: { [objectionId]: rebuttalIndex }
    const userVotes: Record<string, number> = {};
    for (const row of userVotesResult.rows) {
      userVotes[String(row.objection_id)] = Number(row.rebuttal_index);
    }

    return res.json({ ok: true, votes, userVotes });
  });

  // POST /api/objection-votes — cast or change vote
  app.post("/api/objection-votes", async (req, res) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });
    const userId = Number(user.id);

    const objectionId = typeof req.body?.objectionId === "string" ? req.body.objectionId.trim() : "";
    const rebuttalIndex = typeof req.body?.rebuttalIndex === "number" ? req.body.rebuttalIndex : Number(req.body?.rebuttalIndex);

    if (!objectionId || !Number.isFinite(rebuttalIndex) || rebuttalIndex < 0) {
      return res.status(400).json({ ok: false, error: "objectionId and rebuttalIndex required" });
    }

    await pool.query(
      `INSERT INTO objection_votes (user_id, objection_id, rebuttal_index, created_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, objection_id)
       DO UPDATE SET rebuttal_index = EXCLUDED.rebuttal_index, created_at = now()`,
      [userId, objectionId, rebuttalIndex]
    );

    return res.json({ ok: true });
  });

  // DELETE /api/objection-votes/:objectionId — remove vote
  app.delete("/api/objection-votes/:objectionId", async (req, res) => {
    const user = (req as any).authUser;
    if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });
    const userId = Number(user.id);
    const objectionId = req.params.objectionId;
    await pool.query(
      `DELETE FROM objection_votes WHERE user_id = $1 AND objection_id = $2`,
      [userId, objectionId]
    );
    return res.json({ ok: true });
  });
}
