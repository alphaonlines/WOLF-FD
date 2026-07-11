"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const boardAiAgent_1 = require("./boardAiAgent");
(0, vitest_1.describe)("boardAiAgent", () => {
    (0, vitest_1.it)("defaults to disabled and uses sales-floor every three hours", () => {
        const config = (0, boardAiAgent_1.buildBoardAiConfig)({});
        (0, vitest_1.expect)(config.enabled).toBe(false);
        (0, vitest_1.expect)(config.intervalMs).toBe(3 * 60 * 60 * 1000);
        (0, vitest_1.expect)(config.channels).toEqual(["sales-floor"]);
        (0, vitest_1.expect)(config.model).toBe("gemma4:e4b-it-q4_K_M");
    });
    (0, vitest_1.it)("runs during configured hours and includes weekends by default", () => {
        const config = (0, boardAiAgent_1.buildBoardAiConfig)({
            BOARD_AI_AGENT_ENABLED: "true",
            BOARD_AI_AGENT_WORKDAY_START: "09:00",
            BOARD_AI_AGENT_WORKDAY_END: "17:00",
        });
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-01T14:30:00"), config)).toBe(true);
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-01T08:59:00"), config)).toBe(false);
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-01T17:01:00"), config)).toBe(false);
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-02T11:00:00"), config)).toBe(true);
    });
    (0, vitest_1.it)("can disable weekend runs by env flag", () => {
        const config = (0, boardAiAgent_1.buildBoardAiConfig)({
            BOARD_AI_AGENT_ENABLED: "true",
            BOARD_AI_AGENT_INCLUDE_WEEKENDS: "false",
        });
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-02T11:00:00"), config)).toBe(false);
        (0, vitest_1.expect)((0, boardAiAgent_1.isWithinBoardAiWorkday)(new Date("2026-05-04T11:00:00"), config)).toBe(true);
    });
    (0, vitest_1.it)("cleans generated text and labels it as WOLFbot", () => {
        const text = (0, boardAiAgent_1.normalizeBoardAiMessage)("Customer asks about a recliner. Show power headrest value.");
        (0, vitest_1.expect)(text).toBe("WOLFbot Product Coach: Customer asks about a recliner. Show power headrest value.");
    });
    (0, vitest_1.it)("rotates manufacturer focus and skips a brand mentioned in recent messages", () => {
        const recent = ["WOLFbot Product Coach: With Jackson/Catnapper, point out Steel Tech."];
        const selected = (0, boardAiAgent_1.selectManufacturerFocus)(new Date("2026-05-04T10:00:00"), recent);
        (0, vitest_1.expect)(selected).not.toBe("jackson-catnapper");
    });
    (0, vitest_1.it)("builds a brand-specific prompt from manufacturer knowledge", () => {
        const prompt = (0, boardAiAgent_1.buildBoardAiPrompt)("sales-floor", {
            manufacturer: "Jackson/Catnapper",
            manufacturerSlug: "jackson-catnapper",
            source: "database",
            talkingPoints: ["Steel Tech framing uses a steel rail and stretcher system."],
            catalogExamples: ["642: power reclining sofa; features: power headrest"],
        }, ["Old post about sectional shapes."]);
        (0, vitest_1.expect)(prompt).toContain("sales-floor");
        (0, vitest_1.expect)(prompt).toContain("Jackson/Catnapper");
        (0, vitest_1.expect)(prompt).toContain("Steel Tech");
        (0, vitest_1.expect)(prompt).toContain("power reclining sofa");
        (0, vitest_1.expect)(prompt).toContain("Recent WOLFbot posts to avoid repeating");
        (0, vitest_1.expect)(prompt).toContain("Do not pretend to be a human employee");
        (0, vitest_1.expect)(prompt).toContain("do not write generic sectional-shape advice");
    });
    (0, vitest_1.it)("loads manufacturer notes and catalog examples before using fallback points", async () => {
        const pool = {
            query: vitest_1.vi.fn(async (sql) => {
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
        };
        const knowledge = await (0, boardAiAgent_1.loadManufacturerKnowledge)(pool, "jackson-catnapper");
        (0, vitest_1.expect)(knowledge.source).toBe("database");
        (0, vitest_1.expect)(knowledge.manufacturer).toBe("Jackson/Catnapper");
        (0, vitest_1.expect)(knowledge.talkingPoints.join("\n")).toContain("Comfort Coil");
        (0, vitest_1.expect)(knowledge.catalogExamples.join("\n")).toContain("Power Reclining Sofa");
    });
    (0, vitest_1.it)("generates and inserts one grounded channel message when due", async () => {
        const queries = [];
        const pool = {
            query: vitest_1.vi.fn(async (sql, values) => {
                queries.push({ sql, values });
                if (sql.includes("FROM board_messages"))
                    return { rows: [] };
                if (sql.includes("manufacturer_reference_notes"))
                    return { rows: [] };
                if (sql.includes("manufacturer_catalog_items"))
                    return { rows: [] };
                return { rows: [{ id: 42 }] };
            }),
        };
        const generate = vitest_1.vi.fn(async (_model, _channel, prompt) => ({
            text: "With Vaughan-Bassett, tell customers: this is solid American wood built for long-term bedroom value.",
            inputTokens: prompt.length,
            outputTokens: 2,
        }));
        const config = (0, boardAiAgent_1.buildBoardAiConfig)({
            BOARD_AI_AGENT_ENABLED: "true",
            BOARD_AI_AGENT_CHANNELS: "sales-floor,inventory",
        });
        const result = await (0, boardAiAgent_1.runBoardAiAgentOnce)({
            pool,
            config,
            now: new Date("2026-05-01T10:00:00"),
            generate,
        });
        (0, vitest_1.expect)(result.posted).toBe(true);
        (0, vitest_1.expect)(result.channel).toBe("sales-floor");
        (0, vitest_1.expect)(generate).toHaveBeenCalledOnce();
        (0, vitest_1.expect)(generate.mock.calls[0][2]).toContain("Today’s manufacturer focus");
        (0, vitest_1.expect)(queries.some((query) => query.sql.includes("FROM board_messages"))).toBe(true);
        (0, vitest_1.expect)(queries.some((query) => query.sql.includes("manufacturer_reference_notes"))).toBe(true);
        (0, vitest_1.expect)(queries.some((query) => query.sql.includes("manufacturer_catalog_items"))).toBe(true);
        const insert = queries.find((query) => query.sql.includes("INSERT INTO board_messages"));
        (0, vitest_1.expect)(insert?.values).toMatchObject([
            "channel",
            "sales-floor",
            vitest_1.expect.stringContaining("WOLFbot Product Coach:"),
            false,
            "WOLFbot Product Coach",
            "wolfbot@furnituredistributors.local",
        ]);
    });
});
//# sourceMappingURL=boardAiAgent.test.js.map