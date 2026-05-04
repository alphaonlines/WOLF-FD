import { describe, expect, it, vi } from "vitest";
import {
  buildBoardAiPrompt,
  buildBoardAiConfig,
  isWithinBoardAiWorkday,
  loadManufacturerKnowledge,
  normalizeBoardAiMessage,
  runBoardAiAgentOnce,
  selectManufacturerFocus,
} from "./boardAiAgent";

describe("boardAiAgent", () => {
  it("defaults to disabled and uses sales-floor every three hours", () => {
    const config = buildBoardAiConfig({});

    expect(config.enabled).toBe(false);
    expect(config.intervalMs).toBe(3 * 60 * 60 * 1000);
    expect(config.channels).toEqual(["sales-floor"]);
    expect(config.model).toBe("gemma4:e4b-it-q4_K_M");
  });

  it("runs during configured hours and includes weekends by default", () => {
    const config = buildBoardAiConfig({
      BOARD_AI_AGENT_ENABLED: "true",
      BOARD_AI_AGENT_WORKDAY_START: "09:00",
      BOARD_AI_AGENT_WORKDAY_END: "17:00",
    });

    expect(isWithinBoardAiWorkday(new Date("2026-05-01T14:30:00"), config)).toBe(true);
    expect(isWithinBoardAiWorkday(new Date("2026-05-01T08:59:00"), config)).toBe(false);
    expect(isWithinBoardAiWorkday(new Date("2026-05-01T17:01:00"), config)).toBe(false);
    expect(isWithinBoardAiWorkday(new Date("2026-05-02T11:00:00"), config)).toBe(true);
  });

  it("can disable weekend runs by env flag", () => {
    const config = buildBoardAiConfig({
      BOARD_AI_AGENT_ENABLED: "true",
      BOARD_AI_AGENT_INCLUDE_WEEKENDS: "false",
    });

    expect(isWithinBoardAiWorkday(new Date("2026-05-02T11:00:00"), config)).toBe(false);
    expect(isWithinBoardAiWorkday(new Date("2026-05-04T11:00:00"), config)).toBe(true);
  });

  it("cleans generated text and labels it as WOLFbot", () => {
    const text = normalizeBoardAiMessage("Customer asks about a recliner. Show power headrest value.");

    expect(text).toBe("WOLFbot Product Coach: Customer asks about a recliner. Show power headrest value.");
  });

  it("rotates manufacturer focus and skips a brand mentioned in recent messages", () => {
    const recent = ["WOLFbot Product Coach: With Jackson/Catnapper, point out Steel Tech."];
    const selected = selectManufacturerFocus(new Date("2026-05-04T10:00:00"), recent);

    expect(selected).not.toBe("jackson-catnapper");
  });

  it("builds a brand-specific prompt from manufacturer knowledge", () => {
    const prompt = buildBoardAiPrompt(
      "sales-floor",
      {
        manufacturer: "Jackson/Catnapper",
        manufacturerSlug: "jackson-catnapper",
        source: "database",
        talkingPoints: ["Steel Tech framing uses a steel rail and stretcher system."],
        catalogExamples: ["642: power reclining sofa; features: power headrest"],
      },
      ["Old post about sectional shapes."]
    );

    expect(prompt).toContain("sales-floor");
    expect(prompt).toContain("Jackson/Catnapper");
    expect(prompt).toContain("Steel Tech");
    expect(prompt).toContain("power reclining sofa");
    expect(prompt).toContain("Recent WOLFbot posts to avoid repeating");
    expect(prompt).toContain("Do not pretend to be a human employee");
    expect(prompt).toContain("do not write generic sectional-shape advice");
  });

  it("loads manufacturer notes and catalog examples before using fallback points", async () => {
    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("manufacturer_reference_notes")) {
          return {
            rows: [
              {
                manufacturer: "Jackson/Catnapper",
                manufacturer_slug: "jackson-catnapper",
                title: "AI Product Knowledge - Sales Talking Points",
                content: "Comfort Coil and Comfort Gel are clear comfort demo points.",
                note_type: "sales_tips",
              },
            ],
          };
        }
        if (sql.includes("manufacturer_catalog_items")) {
          return {
            rows: [
              {
                sku: "642",
                description: "Power Reclining Sofa",
                category: "Motion",
                product_type: "Sofa",
                collection_name: "Demo Collection",
                upholstery_cover: "Pebble",
                feature_tags: ["power headrest"],
                source_note: "Floor model has power headrest.",
              },
            ],
          };
        }
        return { rows: [] };
      }),
    } as any;

    const knowledge = await loadManufacturerKnowledge(pool, "jackson-catnapper");

    expect(knowledge.source).toBe("database");
    expect(knowledge.manufacturer).toBe("Jackson/Catnapper");
    expect(knowledge.talkingPoints.join("\n")).toContain("Comfort Coil");
    expect(knowledge.catalogExamples.join("\n")).toContain("Power Reclining Sofa");
  });

  it("generates and inserts one grounded channel message when due", async () => {
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    const pool = {
      query: vi.fn(async (sql: string, values: unknown[]) => {
        queries.push({ sql, values });
        if (sql.includes("FROM board_messages")) return { rows: [] };
        if (sql.includes("manufacturer_reference_notes")) return { rows: [] };
        if (sql.includes("manufacturer_catalog_items")) return { rows: [] };
        return { rows: [{ id: 42 }] };
      }),
    } as any;
    const generate = vi.fn(async (_model: string, _channel: string, prompt: string) => ({
      text: "With Vaughan-Bassett, tell customers: this is solid American wood built for long-term bedroom value.",
      inputTokens: prompt.length,
      outputTokens: 2,
    }));
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
    expect(generate.mock.calls[0][2]).toContain("Today’s manufacturer focus");
    expect(queries.some((query) => query.sql.includes("FROM board_messages"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("manufacturer_reference_notes"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("manufacturer_catalog_items"))).toBe(true);
    const insert = queries.find((query) => query.sql.includes("INSERT INTO board_messages"));
    expect(insert?.values).toMatchObject([
      "channel",
      "sales-floor",
      expect.stringContaining("WOLFbot Product Coach:"),
      false,
      "WOLFbot Product Coach",
      "wolfbot@furnituredistributors.local",
    ]);
  });
});
