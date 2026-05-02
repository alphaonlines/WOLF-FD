import type { Pool } from "pg";
import { callBotBotLocalAi, type LLMResponse } from "./llmClient";
import { OLLAMA_PRIMARY_MODEL } from "./runtimeConfig";

export type BoardAiConfig = {
  enabled: boolean;
  intervalMs: number;
  workdayStart: string;
  workdayEnd: string;
  channels: string[];
  model: string;
  authorName: string;
  authorEmail: string;
};

type EnvLike = Record<string, string | undefined>;
type BoardAiGenerate = (model: string, channel: string) => Promise<LLMResponse>;

type RunBoardAiOnceInput = {
  pool: Pick<Pool, "query">;
  config: BoardAiConfig;
  now?: Date;
  generate?: BoardAiGenerate;
};

type RunBoardAiOnceResult = {
  posted: boolean;
  skippedReason?: string;
  channel?: string;
  messageId?: number;
  body?: string;
};

const DEFAULT_CHANNELS = ["sales-floor"];
const CHANNEL_RE = /^[a-z0-9-]{2,40}$/;

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseChannels(value: string | undefined): string[] {
  const channels = String(value || "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => CHANNEL_RE.test(part));
  return channels.length ? Array.from(new Set(channels)) : [...DEFAULT_CHANNELS];
}

function normalizeTime(value: string | undefined, fallback: string): string {
  const raw = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((part) => Number(part));
  return h * 60 + m;
}

export function buildBoardAiConfig(env: EnvLike = process.env): BoardAiConfig {
  const intervalHours = parsePositiveNumber(env.BOARD_AI_AGENT_INTERVAL_HOURS, 3);
  return {
    enabled: String(env.BOARD_AI_AGENT_ENABLED || "false").trim().toLowerCase() === "true",
    intervalMs: Math.max(intervalHours * 60 * 60 * 1000, 15 * 60 * 1000),
    workdayStart: normalizeTime(env.BOARD_AI_AGENT_WORKDAY_START, "09:00"),
    workdayEnd: normalizeTime(env.BOARD_AI_AGENT_WORKDAY_END, "17:00"),
    channels: parseChannels(env.BOARD_AI_AGENT_CHANNELS),
    model: String(env.BOARD_AI_AGENT_MODEL || OLLAMA_PRIMARY_MODEL || "gemma4:e4b-it-q4_K_M").trim(),
    authorName: String(env.BOARD_AI_AGENT_AUTHOR_NAME || "WOLFbot Product Coach").trim(),
    authorEmail: String(env.BOARD_AI_AGENT_AUTHOR_EMAIL || "wolfbot@furnituredistributors.local").trim(),
  };
}

export function isWithinBoardAiWorkday(now: Date, config: BoardAiConfig): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= timeToMinutes(config.workdayStart) && minutes <= timeToMinutes(config.workdayEnd);
}

export function normalizeBoardAiMessage(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^```(?:text|markdown)?/i, "")
    .replace(/```$/i, "")
    .replace(/^[\"']+|[\"']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const body = cleaned || "Ask one customer-focused product question on the sales floor today.";
  if (/^wolfbot\b/i.test(body)) return body.slice(0, 900);
  return `WOLFbot Product Coach: ${body}`.slice(0, 900);
}

export function buildBoardAiPrompt(channel: string): string {
  return `You write short helpful Message Board posts for Furniture Distributors staff. Channel: ${channel}.

Create one practical post that keeps the work channel active and useful. Focus on product demo talk tracks, product information, sales coaching, inventory awareness, showroom questions, or customer Q&A.

Rules:
- 1 to 3 short sentences only.
- Friendly, useful, and retail-floor practical.
- Do not pretend to be a human employee.
- Do not mention that you are scheduled automation.
- No hashtags, no markdown tables, no long paragraphs.
- If you write a customer/salesperson mini-conversation, keep it compact.`;
}

function pickChannel(channels: string[], now: Date): string {
  if (!channels.length) return "sales-floor";
  const index = Math.abs(now.getDay() * 24 + now.getHours()) % channels.length;
  return channels[index] || channels[0];
}

async function defaultGenerate(model: string, channel: string): Promise<LLMResponse> {
  return callBotBotLocalAi(
    model,
    [{ role: "user", content: `Write the next WOLF message board post for #${channel}.` }],
    buildBoardAiPrompt(channel)
  );
}

export async function runBoardAiAgentOnce(input: RunBoardAiOnceInput): Promise<RunBoardAiOnceResult> {
  const now = input.now ?? new Date();
  const config = input.config;
  if (!config.enabled) return { posted: false, skippedReason: "disabled" };
  if (!isWithinBoardAiWorkday(now, config)) return { posted: false, skippedReason: "outside_workday" };

  const channel = pickChannel(config.channels, now);
  const generate = input.generate ?? defaultGenerate;
  const response = await generate(config.model, channel);
  const body = normalizeBoardAiMessage(response.text);

  const insert = await input.pool.query(
    `
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
    `,
    ["channel", channel, body, false, config.authorName, config.authorEmail]
  );

  return {
    posted: true,
    channel,
    body,
    messageId: Number((insert as any).rows?.[0]?.id || 0) || undefined,
  };
}

export function startBoardAiAgent(pool: Pool, env: EnvLike = process.env) {
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
  console.log(
    `Board AI agent enabled for ${config.channels.join(", ")} every ${Math.round(config.intervalMs / 60000)} minutes during ${config.workdayStart}-${config.workdayEnd}.`
  );

  return {
    enabled: true,
    stop: () => clearInterval(interval),
  };
}
