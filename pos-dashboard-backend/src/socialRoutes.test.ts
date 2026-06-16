import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { registerSocialRoutes } from "./routes/socialRoutes";

const makeApp = (query: ReturnType<typeof vi.fn>) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).authUser = {
      id: "7",
      name: "Owner",
      email: "owner@example.com",
      roles: ["Owner"],
    };
    next();
  });
  registerSocialRoutes({
    app,
    pool: { query } as any,
    socialUploadsDir: "/tmp/wolf-fd-social-test-uploads",
    publicBaseUrl: "http://localhost:5057",
    runSocialDueJobsOnce: async () => 0,
  });
  return app;
};

describe("social routes", () => {
  it("deletes a social post and its queued publish jobs", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 42 }] });
    const app = makeApp(query);

    const response = await request(app).delete("/api/social/posts/42");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, id: "42" });
    expect(query.mock.calls[0][0]).toContain("DELETE FROM social_publish_jobs");
    expect(query.mock.calls[0][1]).toEqual([42]);
    expect(query.mock.calls[1][0]).toContain("DELETE FROM social_posts");
    expect(query.mock.calls[1][1]).toEqual([42]);
  });
});
