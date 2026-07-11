import type { Pool } from "pg";
import { type LLMResponse } from "./llmClient";
export type BoardAiConfig = {
    enabled: boolean;
    intervalMs: number;
    workdayStart: string;
    workdayEnd: string;
    channels: string[];
    model: string;
    authorName: string;
    authorEmail: string;
    includeWeekends: boolean;
};
type EnvLike = Record<string, string | undefined>;
type BoardAiGenerate = (model: string, channel: string, prompt: string) => Promise<LLMResponse>;
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
export type BoardAiManufacturerKnowledge = {
    manufacturer: string;
    manufacturerSlug: string;
    talkingPoints: string[];
    catalogExamples: string[];
    source: "database" | "fallback";
};
declare const MANUFACTURER_FOCUS: readonly ["best", "england", "jackson-catnapper", "vaughan-bassett", "archbold"];
type ManufacturerSlug = (typeof MANUFACTURER_FOCUS)[number];
export declare function buildBoardAiConfig(env?: EnvLike): BoardAiConfig;
export declare function isWithinBoardAiWorkday(now: Date, config: BoardAiConfig): boolean;
export declare function normalizeBoardAiMessage(raw: string): string;
export declare function selectManufacturerFocus(now: Date, recentMessages?: string[]): ManufacturerSlug;
export declare function loadManufacturerKnowledge(pool: Pick<Pool, "query">, manufacturerSlug: string): Promise<BoardAiManufacturerKnowledge>;
export declare function buildBoardAiPrompt(channel: string, knowledge?: BoardAiManufacturerKnowledge, recentMessages?: string[]): string;
export declare function runBoardAiAgentOnce(input: RunBoardAiOnceInput): Promise<RunBoardAiOnceResult>;
export declare function startBoardAiAgent(pool: Pool, env?: EnvLike): {
    enabled: boolean;
    stop: () => any;
};
export {};
