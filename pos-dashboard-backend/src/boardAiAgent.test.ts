
import { describe, expect, it, vi } from "vitest";
import {
  buildBoardAiPrompt,
  buildBoardAiConfig,
  isWithinBoardAiWorkday,
  normalizeBoardAiMessage,
  runBoardAiAgentOnce,
} from "./boardAiAgent";

describe("boardAiAgent", () => {
  it("defaults to disabled and uses sales-floor every three hours", () => {
    const config = buildBoardAiConfig({});

    expect(config.enabled).toBe(false);
    expect(config.intervalMs).toBe(3 * 60 * 60 * 1000);
    expect(config.channels).toEqual(["sales-floor"]);
    expect(config.model).toBe("gemma4:e4b-it-q4_K_M");
  });

  it("only runs on weekdays during configured workday hours", () => {
    const config = buildBoardAiConfig({
      BOARD_AI_AGENT_ENABLED: "true",
      BOARD_AI_AGENT_WORKDAY_START: "09:00",
      BOARD_AI_AGENT_WORKDAY_END: "17:00",
    });

    expect(isWithinBoardAiWorkday(new Date("2026-05-01T14:30:00"), config)).toBe(true);
    expect(isWithinBoardAiWorkday(new Date("2026-05-01T08:59:00"), config)).toBe(false);
    expect(isWithinBoardAiWorkday(new Date("2026-05-01T17:01:00"), config)).toBe(false);
    expect(isWithinBoardAiWorkday(new Date("2026-05-02T11:00:00"), config)).toBe(false);
  });

  it("cleans generated text and labels it as WOLFbot", () => {
    const text = normalizeBoardAiMessage('Customer asks about a recliner. Show power headrest value.');

    expect(text).toBe("WOLFbot Product Coach: Customer asks about a recliner. Show power headrest value.");
  });

  it("builds a product-focused prompt for the selected board channel", () => {
    const prompt = buildBoardAiPrompt("inventory");

    expect(prompt).toContain("inventory");
    expect(prompt).toContain("Furniture Distributors");
    expect(prompt).toContain("product");
    expect(prompt).toContain("Do not pretend to be a human employee");
  });

  it("generates and inserts one channel message when due", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        return { rows: [{ id: 42 }] };
      }),
    } as any;
    const generate = vi.fn(async () => ({ text: "Ask the customer if they prefer plush comfort or firm support.", inputTokens: 1, outputTokens: 2 }));
    const config = buildBoardAiConfig({
      BOARD_AI_AGENT_ENABLED: "true",
      BOARD_AI_AGENT_CHANNELS: "sales-floor,inventory",
    });

    const result = await runBoardAiAgentOnce({
      pool,
      config,
      now: new Date("2026-05-01T10:00:00"),
      generate,
    });

    expect(result.posted).toBe(true);
    expect(result.channel).toBe("sales-floor");
    expect(generate).toHaveBeenCalledOnce();
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("INSERT INTO board_messages");
    expect(queries[0].values).toMatchObject([
      "channel",
      "sales-floor",
      expect.stringContaining("WOLFbot Product Coach:"),
      false,
      "WOLFbot Product Coach",
      "wolfbot@furnituredistributors.local",
    ]);
  });
});
