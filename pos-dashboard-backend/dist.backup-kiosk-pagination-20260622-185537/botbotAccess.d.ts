import type { Pool } from "pg";
import type { PageContext } from "./botbotPrompt";
export type BotBotSubjectType = "role" | "user";
export type BotBotAuthUser = {
    id: string;
    name: string;
    roles: string[];
};
export type BotBotSkill = {
    skillKey: string;
    label: string;
    description: string;
    defaultAllowed: boolean;
    adminOnly?: boolean;
};
export declare const BOTBOT_SKILL_CATALOG: BotBotSkill[];
export declare function normalizeRoleKey(role: string): string;
export declare function userRoleKeys(user: BotBotAuthUser): string[];
export declare function isAdminRole(user: BotBotAuthUser): boolean;
export declare function inferBotBotSkill(pageContext?: PageContext): string;
export declare function skillDefaultsForUser(skillKey: string, user: BotBotAuthUser): boolean;
export declare function isLocalProvider(provider: string): boolean;
export declare function defaultModelAllowed(provider: string): boolean;
export declare function resolveModelAccess(pool: Pool, user: BotBotAuthUser, modelKey: string, provider: string, fallbackQuota: number): Promise<{
    allowed: boolean;
    tokenQuota: number;
    source: "user";
} | {
    allowed: boolean;
    tokenQuota: number;
    source: "role";
} | {
    allowed: boolean;
    tokenQuota: number;
    source: "default";
}>;
export declare function resolveSkillAccess(pool: Pool, user: BotBotAuthUser, skillKey: string): Promise<{
    allowed: boolean;
    source: "user";
} | {
    allowed: boolean;
    source: "role";
} | {
    allowed: boolean;
    source: "default";
}>;
