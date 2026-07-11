import type { Express } from "express";
import type { Pool } from "pg";
type RegisterStripeTopupRoutesDeps = {
    app: Express;
    pool: Pool;
    webhookPath: string;
    webhookSecret: string;
    secretKey: string;
    publicBaseUrl: string;
    defaultModelKey: string;
    externalLedgerToken?: string;
};
export type BotBotStripeTokenPack = {
    id: string;
    label: string;
    priceUsd: number;
    priceCents: number;
    tokens: number;
    modelKey: string;
    description: string;
    featured?: boolean;
};
export declare const BOTBOT_STRIPE_TOKEN_PACKS: BotBotStripeTokenPack[];
export declare function registerStripeTopupRoutes({ app, pool, webhookPath, webhookSecret, secretKey, publicBaseUrl, defaultModelKey, externalLedgerToken, }: RegisterStripeTopupRoutesDeps): void;
export {};
