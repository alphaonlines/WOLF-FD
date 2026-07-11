"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBoardAiConfig = buildBoardAiConfig;
exports.isWithinBoardAiWorkday = isWithinBoardAiWorkday;
exports.normalizeBoardAiMessage = normalizeBoardAiMessage;
exports.selectManufacturerFocus = selectManufacturerFocus;
exports.loadManufacturerKnowledge = loadManufacturerKnowledge;
exports.buildBoardAiPrompt = buildBoardAiPrompt;
exports.runBoardAiAgentOnce = runBoardAiAgentOnce;
exports.startBoardAiAgent = startBoardAiAgent;
const llmClient_1 = require("./llmClient");
const runtimeConfig_1 = require("./runtimeConfig");
const DEFAULT_CHANNELS = ["sales-floor"];
const CHANNEL_RE = /^[a-z0-9-]{2,40}$/;
const RECENT_MESSAGE_LIMIT = 10;
const MAX_PROMPT_POINTS = 8;
const MANUFACTURER_FOCUS = [
    "best",
    "england",
    "jackson-catnapper",
    "vaughan-bassett",
    "archbold",
];
const FALLBACK_MANUFACTURER_KNOWLEDGE = {
    best: {
        manufacturer: "Best Home Furnishings",
        manufacturerSlug: "best",
        source: "fallback",
        talkingPoints: [
            "Made in the USA with domestic and globally sourced components.",
            "Strong recliner, lift chair, and motion seating story for comfort-first shoppers.",
            "Use fabric, performance-fabric, and customizer choices to move the conversation beyond price.",
            "Good fit when a customer wants practical comfort, easy-to-understand options, and a piece that can fit their room style.",
        ],
        catalogExamples: [],
    },
    england: {
        manufacturer: "England Furniture",
        manufacturerSlug: "england",
        source: "fallback",
        talkingPoints: [
            "Made/build-focused upholstery brand with Tennessee/Appalachia manufacturing heritage.",
            "Excellent custom upholstery conversation: style, fabric, pillow, cushion, and cover choices.",
            "Known in the dashboard uploads for 21 Day Delivery scheduling, so speed plus customization should be part of the talk track.",
            "Best angle: help the shopper create something that does not look like every sofa or sectional on every floor.",
        ],
        catalogExamples: [],
    },
    "jackson-catnapper": {
        manufacturer: "Jackson/Catnapper",
        manufacturerSlug: "jackson-catnapper",
        source: "fallback",
        talkingPoints: [
            "USA-focused manufacturing with a comfort-first reclining and upholstery story.",
            "Steel Tech framing uses a steel rail and stretcher system; this is a durability talking point.",
            "Comfort Coil seat cushions and Comfort Gel help explain support, cooler seating feel, and reduced motion transfer.",
            "Power headrest, lumbar, Zero Gravity, heat, and massage options are easy add-on value points when the floor model has them.",
        ],
        catalogExamples: [],
    },
    "vaughan-bassett": {
        manufacturer: "Vaughan-Bassett",
        manufacturerSlug: "vaughan-bassett",
        source: "fallback",
        talkingPoints: [
            "Made in the USA and based in Galax, Virginia.",
            "Over 100 years of furniture manufacturing history.",
            "Solid American wood story: cherry, oak, maple, and birch depending on collection.",
            "Strong casegoods/bedroom angle for customers who want long-term value instead of disposable bedroom furniture.",
        ],
        catalogExamples: [],
    },
    archbold: {
        manufacturer: "Archbold Furniture",
        manufacturerSlug: "archbold",
        source: "fallback",
        talkingPoints: [
            "Solid wood furniture made in Archbold, Ohio since 1900.",
            "American-built solid wood with custom Amish finish options.",
            "Construction details matter: solid tops, sides, drawer parts, English dovetail drawers, and smooth glides.",
            "Use Archbold when the customer values heirloom feel, finish choice, and real wood construction.",
        ],
        catalogExamples: [],
    },
};
function parsePositiveNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function parseChannels(value) {
    const channels = String(value || "")
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter((part) => CHANNEL_RE.test(part));
    return channels.length ? Array.from(new Set(channels)) : [...DEFAULT_CHANNELS];
}
function normalizeTime(value, fallback) {
    const raw = String(value || "").trim();
    return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}
function timeToMinutes(value) {
    const [h, m] = value.split(":").map((part) => Number(part));
    return h * 60 + m;
}
function cleanSnippet(value, max = 220) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}
function uniqueNonEmpty(values, limit) {
    const seen = new Set();
    const out = [];
    for (const value of values) {
        const cleaned = cleanSnippet(value);
        const key = cleaned.toLowerCase();
        if (!cleaned || seen.has(key))
            continue;
        seen.add(key);
        out.push(cleaned);
        if (out.length >= limit)
            break;
    }
    return out;
}
function buildBoardAiConfig(env = process.env) {
    const intervalHours = parsePositiveNumber(env.BOARD_AI_AGENT_INTERVAL_HOURS, 3);
    return {
        enabled: String(env.BOARD_AI_AGENT_ENABLED || "false").trim().toLowerCase() === "true",
        intervalMs: Math.max(intervalHours * 60 * 60 * 1000, 15 * 60 * 1000),
        workdayStart: normalizeTime(env.BOARD_AI_AGENT_WORKDAY_START, "09:00"),
        workdayEnd: normalizeTime(env.BOARD_AI_AGENT_WORKDAY_END, "17:00"),
        channels: parseChannels(env.BOARD_AI_AGENT_CHANNELS),
        model: String(env.BOARD_AI_AGENT_MODEL || runtimeConfig_1.OLLAMA_PRIMARY_MODEL || "gemma4:e4b-it-q4_K_M").trim(),
        authorName: String(env.BOARD_AI_AGENT_AUTHOR_NAME || "WOLFbot Product Coach").trim(),
        authorEmail: String(env.BOARD_AI_AGENT_AUTHOR_EMAIL || "wolfbot@furnituredistributors.local").trim(),
        includeWeekends: String(env.BOARD_AI_AGENT_INCLUDE_WEEKENDS || "true").trim().toLowerCase() !== "false",
    };
}
function isWithinBoardAiWorkday(now, config) {
    const day = now.getDay();
    if (!config.includeWeekends && (day === 0 || day === 6))
        return false;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= timeToMinutes(config.workdayStart) && minutes <= timeToMinutes(config.workdayEnd);
}
function normalizeBoardAiMessage(raw) {
    const cleaned = String(raw || "")
        .trim()
        .replace(/^```(?:text|markdown)?/i, "")
        .replace(/```$/i, "")
        .replace(/^[\"']+|[\"']+$/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const body = cleaned || "Ask one customer-focused product question on the sales floor today.";
    if (/^wolfbot\b/i.test(body))
        return body.slice(0, 900);
    return `WOLFbot Product Coach: ${body}`.slice(0, 900);
}
function selectManufacturerFocus(now, recentMessages = []) {
    const slot = now.getDay() * 8 + Math.floor(now.getHours() / 3);
    const normalizedRecent = recentMessages.join("\n").toLowerCase();
    for (let offset = 0; offset < MANUFACTURER_FOCUS.length; offset += 1) {
        const slug = MANUFACTURER_FOCUS[(slot + offset) % MANUFACTURER_FOCUS.length];
        const profile = FALLBACK_MANUFACTURER_KNOWLEDGE[slug];
        const wasRecent = normalizedRecent.includes(slug) ||
            normalizedRecent.includes(profile.manufacturer.toLowerCase()) ||
            (slug === "best" && normalizedRecent.includes("best home")) ||
            (slug === "jackson-catnapper" && (normalizedRecent.includes("jackson") || normalizedRecent.includes("catnapper")));
        if (!wasRecent)
            return slug;
    }
    return MANUFACTURER_FOCUS[slot % MANUFACTURER_FOCUS.length];
}
async function loadRecentBoardAiMessages(pool, channel, authorEmail) {
    try {
        const result = await pool.query(`
      SELECT body
      FROM board_messages
      WHERE scope = 'channel'
        AND channel = $1
        AND author_email = $2
      ORDER BY created_at DESC
      LIMIT $3
      `, [channel, authorEmail, RECENT_MESSAGE_LIMIT]);
        return Array.isArray(result.rows) ? result.rows.map((row) => cleanSnippet(row.body, 500)).filter(Boolean) : [];
    }
    catch (error) {
        console.warn("Board AI agent could not load recent messages; continuing with fallback rotation.", error);
        return [];
    }
}
async function loadManufacturerKnowledge(pool, manufacturerSlug) {
    const fallback = FALLBACK_MANUFACTURER_KNOWLEDGE[manufacturerSlug] || FALLBACK_MANUFACTURER_KNOWLEDGE.best;
    try {
        const notesResult = await pool.query(`
      SELECT manufacturer, manufacturer_slug, title, content, note_type
      FROM manufacturer_reference_notes
      WHERE manufacturer_slug = $1
        AND COALESCE(content, '') <> ''
      ORDER BY
        CASE
          WHEN title ILIKE 'AI Product Knowledge%' THEN 0
          WHEN note_type IN ('sales_tips', 'product_knowledge', 'warranty') THEN 1
          ELSE 2
        END,
        source_sort_order ASC,
        created_at DESC
      LIMIT 8
      `, [manufacturerSlug]);
        const catalogResult = await pool.query(`
      SELECT sku, description, category, product_type, collection_name, upholstery_cover, feature_tags, source_note
      FROM manufacturer_catalog_items
      WHERE manufacturer_slug = $1
        AND COALESCE(description, '') <> ''
      ORDER BY
        CASE WHEN COALESCE(source_note, '') <> '' THEN 0 ELSE 1 END,
        created_at DESC
      LIMIT 8
      `, [manufacturerSlug]);
        const noteRows = Array.isArray(notesResult.rows) ? notesResult.rows : [];
        const catalogRows = Array.isArray(catalogResult.rows) ? catalogResult.rows : [];
        const talkingPoints = uniqueNonEmpty(noteRows.flatMap((row) => [row.title, row.content]).concat(fallback.talkingPoints), MAX_PROMPT_POINTS);
        const catalogExamples = uniqueNonEmpty(catalogRows.map((row) => {
            const tags = Array.isArray(row.feature_tags) && row.feature_tags.length ? `; features: ${row.feature_tags.join(", ")}` : "";
            const sourceNote = row.source_note ? `; note: ${row.source_note}` : "";
            return `${row.sku || "item"}: ${row.description || ""} ${row.category || row.product_type || ""} ${row.collection_name || ""}${row.upholstery_cover ? `; cover: ${row.upholstery_cover}` : ""}${tags}${sourceNote}`;
        }), 5);
        return {
            manufacturer: cleanSnippet(noteRows[0]?.manufacturer || fallback.manufacturer, 120),
            manufacturerSlug,
            talkingPoints,
            catalogExamples,
            source: noteRows.length || catalogRows.length ? "database" : "fallback",
        };
    }
    catch (error) {
        console.warn(`Board AI agent could not load manufacturer knowledge for ${manufacturerSlug}; using fallback notes.`, error);
        return fallback;
    }
}
function buildBoardAiPrompt(channel, knowledge = FALLBACK_MANUFACTURER_KNOWLEDGE["jackson-catnapper"], recentMessages = []) {
    const points = knowledge.talkingPoints.length ? knowledge.talkingPoints : FALLBACK_MANUFACTURER_KNOWLEDGE[knowledge.manufacturerSlug]?.talkingPoints || [];
    const examples = knowledge.catalogExamples.length ? knowledge.catalogExamples : ["No specific catalog example loaded for this post; keep the message brand-focused."];
    const recent = recentMessages.length ? recentMessages.map((message) => `- ${message}`).join("\n") : "- None loaded";
    return `You write short helpful Message Board posts for Furniture Distributors staff. Channel: ${channel}.

Today’s manufacturer focus: ${knowledge.manufacturer} (${knowledge.manufacturerSlug}).
Knowledge source: ${knowledge.source}.

Use these staff-facing product facts and sales angles. Do not invent warranty durations, materials, features, or policies that are not listed here.
${points.map((point) => `- ${point}`).join("\n")}

Optional catalog examples from the Shop/product database:
${examples.map((example) => `- ${example}`).join("\n")}

Recent WOLFbot posts to avoid repeating:
${recent}

Create one practical post that teaches salespeople how to talk about this brand or one of its features with a customer.

Rules:
- 1 to 3 short sentences only.
- Mention the manufacturer by name.
- Include one customer-facing phrase a salesperson can use today.
- Be specific to the listed manufacturer; do not write generic sectional-shape advice unless the source facts above support it.
- Friendly, useful, and retail-floor practical.
- Do not pretend to be a human employee.
- Do not mention that you are scheduled automation.
- No hashtags, no markdown tables, no long paragraphs.`;
}
function pickChannel(channels, now) {
    if (!channels.length)
        return "sales-floor";
    const index = Math.abs(now.getDay() * 24 + now.getHours()) % channels.length;
    return channels[index] || channels[0];
}
async function defaultGenerate(model, channel, prompt) {
    return (0, llmClient_1.callBotBotLocalAi)(model, [{ role: "user", content: `Write the next WOLF message board product-coaching post for #${channel}.` }], prompt);
}
async function runBoardAiAgentOnce(input) {
    const now = input.now ?? new Date();
    const config = input.config;
    if (!config.enabled)
        return { posted: false, skippedReason: "disabled" };
    if (!isWithinBoardAiWorkday(now, config))
        return { posted: false, skippedReason: "outside_workday" };
    const channel = pickChannel(config.channels, now);
    const recentMessages = await loadRecentBoardAiMessages(input.pool, channel, config.authorEmail);
    const manufacturerSlug = selectManufacturerFocus(now, recentMessages);
    const knowledge = await loadManufacturerKnowledge(input.pool, manufacturerSlug);
    const prompt = buildBoardAiPrompt(channel, knowledge, recentMessages);
    const generate = input.generate ?? defaultGenerate;
    const response = await generate(config.model, channel, prompt);
    const body = normalizeBoardAiMessage(response.text);
    const insert = await input.pool.query(`
    INSERT INTO board_messages (
      scope,
      channel,
      body,
      priority,
      author_name,
      author_email,
      author_user_id,
      recipient_user_id,
      recipient_name,
      recipient_email,
      attachment_upload_id,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, '', '', NULL, now(), now())
    RETURNING id
    `, ["channel", channel, body, false, config.authorName, config.authorEmail]);
    return {
        posted: true,
        channel,
        body,
        messageId: Number(insert.rows?.[0]?.id || 0) || undefined,
    };
}
function startBoardAiAgent(pool, env = process.env) {
    const config = buildBoardAiConfig(env);
    if (!config.enabled) {
        return { enabled: false, stop: () => undefined };
    }
    const tick = () => {
        void runBoardAiAgentOnce({ pool, config }).catch((error) => {
            console.error("Board AI agent tick failed:", error);
        });
    };
    const interval = setInterval(tick, config.intervalMs);
    setTimeout(tick, 30000);
    console.log(`Board AI agent enabled for ${config.channels.join(", ")} every ${Math.round(config.intervalMs / 60000)} minutes during ${config.workdayStart}-${config.workdayEnd}${config.includeWeekends ? " including weekends" : " on weekdays"}.`);
    return {
        enabled: true,
        stop: () => clearInterval(interval),
    };
}
//# sourceMappingURL=boardAiAgent.js.map