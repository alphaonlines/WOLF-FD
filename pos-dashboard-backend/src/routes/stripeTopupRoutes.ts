import express from "express";
import type { Express } from "express";
import type { Pool } from "pg";
import Stripe from "stripe";

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

const TOKEN_RATE_PER_USD = 10_000;
const PACK_DOLLARS = [1, 5, 10, 25, 50, 100, 250];

const packLabel = (dollars: number) => {
  if (dollars === 1) return "$1 Starter";
  if (dollars === 25) return "$25 Team Pack";
  if (dollars === 250) return "$250 Max Pack";
  return `$${dollars} Token Pack`;
};

const packDescription = (dollars: number, tokens: number) => {
  if (dollars === 1) return "Entry refill for quick dashboard questions and one-off AI assists.";
  if (dollars === 25) return "Practical team refill for steady sales-floor and back-office BotBot use.";
  if (dollars === 250) return "Heavy refill for high-volume WOLFbot operations and manager workflows.";
  return `${tokens.toLocaleString()} BotBot tokens at the standard $1 = 10,000 token rate.`;
};

export const BOTBOT_STRIPE_TOKEN_PACKS: BotBotStripeTokenPack[] = PACK_DOLLARS.map((dollars) => {
  const tokens = dollars * TOKEN_RATE_PER_USD;
  return {
    id: `botbot-${dollars}`,
    label: packLabel(dollars),
    priceUsd: dollars,
    priceCents: dollars * 100,
    tokens,
    modelKey: "local",
    description: packDescription(dollars, tokens),
    ...(dollars === 25 ? { featured: true } : {}),
  };
});

const stripeApiVersion = "2026-04-22.dahlia" as any;

const normText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const normEmail = (value: unknown): string => normText(value).toLowerCase();

const parsePositiveInt = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const raw = normText(value).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const publicPack = (pack: BotBotStripeTokenPack) => ({
  id: pack.id,
  label: pack.label,
  priceUsd: pack.priceUsd,
  priceCents: pack.priceCents,
  priceLabel: `$${pack.priceUsd}`,
  tokens: pack.tokens,
  modelKey: pack.modelKey,
  description: pack.description,
  featured: Boolean(pack.featured),
});

const applyPurchasedTokens = async (pool: Pool, userId: number, modelKey: string, creditsRaw: number) => {
  const credits = parsePositiveInt(creditsRaw);
  if (credits <= 0) return;
  const model = normText(modelKey) || "local";

  await pool.query(
    `
      INSERT INTO botbot_token_ledger (user_id, model_key, tokens_purchased, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (user_id, model_key)
      DO UPDATE
        SET tokens_purchased = botbot_token_ledger.tokens_purchased + EXCLUDED.tokens_purchased,
            updated_at = now()
    `,
    [userId, model, credits]
  );
};

const insertStripeEvent = async (
  pool: Pool,
  eventId: string,
  sessionId: string,
  eventType: string,
  userId: number,
  customerEmail: string,
  packId: string,
  modelKey: string,
  tokens: number,
  amountTotal: number,
  currency: string,
  rawPayload: unknown,
  status: string
): Promise<number | null> => {
  const existing = await pool.query(
    `
      SELECT id, status
      FROM stripe_topup_events
      WHERE stripe_event_id = $1 OR stripe_checkout_session_id = $2
      LIMIT 1
    `,
    [eventId, sessionId]
  );
  if (existing.rows.length) return null;

  const inserted = await pool.query(
    `
      INSERT INTO stripe_topup_events (
        stripe_event_id,
        stripe_checkout_session_id,
        event_type,
        user_id,
        customer_email,
        pack_id,
        model_key,
        tokens,
        amount_total,
        currency,
        raw_payload,
        status,
        created_at,
        updated_at,
        processed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, now(), now(), now()
      )
      RETURNING id
    `,
    [
      eventId,
      sessionId,
      eventType,
      userId,
      customerEmail,
      packId,
      modelKey,
      tokens,
      amountTotal,
      currency,
      JSON.stringify(rawPayload ?? {}),
      status,
    ]
  );
  return Number(inserted.rows[0]?.id || 0) || null;
};

export function registerStripeTopupRoutes({
  app,
  pool,
  webhookPath,
  webhookSecret,
  secretKey,
  publicBaseUrl,
  defaultModelKey,
  externalLedgerToken = "",
}: RegisterStripeTopupRoutesDeps): void {
  const stripe = new Stripe(secretKey || "sk_test_placeholder", { apiVersion: stripeApiVersion });
  const normalizedPublicBaseUrl = (publicBaseUrl || "").replace(/\/+$/, "") || "https://furnituredistributors.wolf.discount/fd";

  const safeReturnUrl = (value: unknown, fallback: string) => {
    const raw = normText(value);
    if (!raw) return fallback;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
      if (!url.hostname.endsWith("wolf.discount")) return fallback;
      return url.toString();
    } catch {
      return fallback;
    }
  };

  const createCheckoutForUser = async ({
    userId,
    userEmail,
    pack,
    successUrl,
    cancelUrl,
  }: {
    userId: number | string;
    userEmail: string;
    pack: BotBotStripeTokenPack;
    successUrl?: string;
    cancelUrl?: string;
  }) => {
    if (!secretKey) throw Object.assign(new Error("stripe_not_configured"), { code: "stripe_not_configured" });
    return stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: String(userId),
      customer_email: normEmail(userEmail) || undefined,
      success_url: safeReturnUrl(successUrl, `${normalizedPublicBaseUrl}/?botbot_tokens=success&session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: safeReturnUrl(cancelUrl, `${normalizedPublicBaseUrl}/?botbot_tokens=cancelled`),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `BotBot ${pack.tokens.toLocaleString()} tokens`,
              description: `${pack.label}: $${pack.priceUsd} at $1 = 10,000 BotBot tokens.`,
              metadata: {
                packId: pack.id,
                tokens: String(pack.tokens),
                modelKey: pack.modelKey || defaultModelKey,
              },
            },
          },
        },
      ],
      metadata: {
        source: "wolf-fd-botbot",
        userId: String(userId),
        userEmail: normEmail(userEmail),
        packId: pack.id,
        modelKey: pack.modelKey || defaultModelKey,
        tokens: String(pack.tokens),
      },
    });
  };

  app.get("/api/botbot/token-packs", async (_req, res) => {
    return res.json({ ok: true, rate: { usd: 1, tokens: TOKEN_RATE_PER_USD }, packs: BOTBOT_STRIPE_TOKEN_PACKS.map(publicPack) });
  });

  app.post("/api/botbot/token-packs/checkout", async (req, res) => {
    const user = (req as any).authUser as { id?: string | number; email?: string; name?: string } | undefined;
    if (!user?.id) return res.status(401).json({ ok: false, error: "unauthorized" });

    const packId = normText(req.body?.packId || req.body?.pack_id);
    const pack = BOTBOT_STRIPE_TOKEN_PACKS.find((candidate) => candidate.id === packId);
    if (!pack) return res.status(400).json({ ok: false, error: "invalid_pack_id" });

    if (!secretKey) {
      return res.status(503).json({ ok: false, error: "stripe_not_configured" });
    }
    if (!webhookSecret) {
      return res.status(503).json({ ok: false, error: "stripe_webhook_not_configured" });
    }

    try {
      const session = await createCheckoutForUser({
        userId: user.id,
        userEmail: normEmail(user.email),
        pack,
      });

      return res.json({ ok: true, checkoutUrl: session.url, sessionId: session.id, pack: publicPack(pack) });
    } catch (error: any) {
      return res.status(502).json({ ok: false, error: "stripe_checkout_failed", detail: String(error?.message || error) });
    }
  });

  app.post("/api/botbot/external/token-packs/checkout", async (req, res) => {
    const headerToken = normText(req.headers["x-botbot-ledger-token"]);
    if (!externalLedgerToken || headerToken !== externalLedgerToken) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const packId = normText(req.body?.packId || req.body?.pack_id);
    const pack = BOTBOT_STRIPE_TOKEN_PACKS.find((candidate) => candidate.id === packId);
    if (!pack) return res.status(400).json({ ok: false, error: "invalid_pack_id" });

    const userKey = normEmail(req.body?.externalUserKey || req.body?.username || req.body?.email);
    if (!userKey) return res.status(400).json({ ok: false, error: "externalUserKey required" });

    const userResult = await pool.query(
      `SELECT id, name, email
       FROM users
       WHERE lower(email) = $1
          OR lower(split_part(email, '@', 1)) = $1
          OR lower(name) = $1
       ORDER BY
         CASE
           WHEN lower(email) = $1 THEN 1
           WHEN lower(split_part(email, '@', 1)) = $1 THEN 2
           ELSE 3
         END,
         id ASC
       LIMIT 1`,
      [userKey]
    );
    if (!userResult.rows.length) return res.status(404).json({ ok: false, error: "user_not_found" });

    if (!secretKey) return res.status(503).json({ ok: false, error: "stripe_not_configured" });
    if (!webhookSecret) return res.status(503).json({ ok: false, error: "stripe_webhook_not_configured" });

    try {
      const row = userResult.rows[0];
      const session = await createCheckoutForUser({
        userId: Number(row.id),
        userEmail: normEmail(row.email),
        pack,
        successUrl: req.body?.successUrl,
        cancelUrl: req.body?.cancelUrl,
      });
      return res.json({ ok: true, checkoutUrl: session.url, sessionId: session.id, pack: publicPack(pack) });
    } catch (error: any) {
      return res.status(502).json({ ok: false, error: "stripe_checkout_failed", detail: String(error?.message || error) });
    }
  });

  app.post(webhookPath, express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""));
    const signature = normText(req.get("stripe-signature"));

    let event: any;
    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else if (process.env.NODE_ENV === "test" || process.env.STRIPE_ALLOW_UNSIGNED_WEBHOOKS === "true") {
        event = JSON.parse(rawBody.toString("utf8"));
      } else {
        return res.status(503).json({ ok: false, error: "stripe_webhook_not_configured" });
      }
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: "invalid_stripe_webhook", detail: String(error?.message || error) });
    }

    if (event.type !== "checkout.session.completed") {
      return res.json({ ok: true, ignored: true, event_type: event.type });
    }

    const session = event.data?.object || {};
    if (session.payment_status && session.payment_status !== "paid") {
      return res.json({ ok: true, ignored: true, status: "unpaid_checkout_session" });
    }

    const metadata = session.metadata || {};
    const packId = normText(metadata.packId || metadata.pack_id);
    const pack = BOTBOT_STRIPE_TOKEN_PACKS.find((candidate) => candidate.id === packId);
    const userId = parsePositiveInt(metadata.userId || metadata.user_id || session.client_reference_id);
    const modelKey = normText(metadata.modelKey || metadata.model_key || pack?.modelKey || defaultModelKey) || defaultModelKey;
    const tokens = parsePositiveInt(metadata.tokens || pack?.tokens);
    const amountTotal = parsePositiveInt(session.amount_total);
    const currency = normText(session.currency || "usd").toLowerCase() || "usd";
    const customerEmail = normEmail(metadata.userEmail || metadata.user_email || session.customer_email || session.customer_details?.email);
    const sessionId = normText(session.id);
    const eventId = normText(event.id);

    if (!eventId || !sessionId || !userId || !pack || tokens !== pack.tokens || amountTotal !== pack.priceCents || currency !== "usd") {
      return res.status(400).json({ ok: false, error: "invalid_checkout_metadata" });
    }

    await pool.query("BEGIN");
    try {
      const eventRowId = await insertStripeEvent(
        pool,
        eventId,
        sessionId,
        event.type,
        userId,
        customerEmail,
        pack.id,
        modelKey,
        tokens,
        amountTotal,
        currency,
        event,
        "auto_credited"
      );

      if (!eventRowId) {
        await pool.query("COMMIT");
        return res.json({ ok: true, duplicate: true, status: "already_processed" });
      }

      await applyPurchasedTokens(pool, userId, modelKey, tokens);
      await pool.query("COMMIT");

      return res.json({
        ok: true,
        event_id: eventRowId,
        status: "auto_credited",
        user_id: userId,
        credits_by_model: { [modelKey]: tokens },
      });
    } catch (error: any) {
      await pool.query("ROLLBACK");
      return res.status(500).json({ ok: false, error: "stripe_credit_failed" });
    }
  });
}
