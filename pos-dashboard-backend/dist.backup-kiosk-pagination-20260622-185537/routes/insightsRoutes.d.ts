import type { Express } from "express";
import type { Pool } from "pg";
type RegisterInsightsRoutesDeps = {
    app: Express;
    pool: Pool;
    prefixedDateField: (tableAlias: string) => string;
    safeGrandTotal: string;
    safeProfit: string;
    safeTotalFinanceAmt: string;
    safeFinanceBalance: string;
    safeFinanceFee: string;
};
export declare function registerInsightsRoutes({ app, pool, prefixedDateField, safeGrandTotal, safeProfit, safeTotalFinanceAmt, safeFinanceBalance, safeFinanceFee, }: RegisterInsightsRoutesDeps): void;
export {};
