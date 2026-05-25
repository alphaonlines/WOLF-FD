import express from "express";
import type { Express } from "express";
import type { Pool } from "pg";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type RegisterShopifyTopupRoutesDeps = {
  app: Express;
  pool: Pool;
  webhookPath: string;
  webhookSecret: string;
  defaultModelKey: string;
  variantPackConfigJson: string;
};

type TopupPackConfig = {
  variantId: string;
  modelKey: string;
  creditsPerUnit: number | null;
  label?: string;
};

type ParsedCredits = {
  modelKey: string;
  credits: number;
  quantity: number;
};

const normText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normTextLower = (value: unknown): string => normText(value).toLowerCase();

const normEmail = (value: unknown): string => normTextLower(value);

const parsePositiveInt = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  const raw = normText(value).replace(/,/g, "").replace(/[^0-9.-]/g, "");
  if (!raw) return 0;

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;

  return Math.floor(n);
};

const parseTopupPackMap = (rawJson: string, fallbackModelKey: string): Map<string, TopupPackConfig> => {
  const out = new Map<string, TopupPackConfig>();
  if (!rawJson) return out;

  try {
    const parsed = JSON.parse(rawJson);
    const entries: Array<any> = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed
        ? Object.entries(parsed).map(([variantId, value]) => ({
            variantId,
            ...(typeof value === "object" && value ? value : {}),
          }))
        : [];

    for (const item of entries) {
      const variantId = normText(item?.variantId || item?.variant_id || item?.variant || item?.id || "");
      if (!variantId) continue;

      const modelKey = normText(item?.modelKey || item?.model_key || fallbackModelKey) || fallbackModelKey;
      const rawCredits = parsePositiveInt(item?.creditsPerUnit || item?.credits_per_unit || item?.credits || item?.amount || 0);
      const creditsPerUnit = rawCredits > 0 ? rawCredits : null;
      const label = normText(item?.label || item?.name || item?.title);

      out.set(variantId, {
        variantId,
        modelKey,
        creditsPerUnit,
        ...(label ? { label } : {}),
      });
    }
  } catch {
    // If the config cannot be parsed, ignore it and rely on runtime heuristics.
  }

  return out;
};

const parseCandidateCreditText = (value: unknown, requiredHint = false): number => {
  const raw = normText(value);
  if (!raw) return 0;
  if (requiredHint && !/(token|credit|beople|botbot)/i.test(raw)) return 0;
  return parsePositiveInt(raw);
};

const parseFromProperties = (props: unknown): number => {
  if (!props) return 0;

  const checkPair = (name: unknown, value: unknown): number => {
    const key = normText(name).toLowerCase();
    if (!key) return 0;
    if (!/(token|credit)/i.test(key)) return 0;
    return parseCandidateCreditText(value, false);
  };

  if (Array.isArray(props)) {
    for (const row of props) {
      const maybe = checkPair((row as any)?.name, (row as any)?.value || (row as any)?.properties?.value || "");
      if (maybe > 0) return maybe;
    }
    return 0;
  }

  if (typeof props === "object") {
    for (const [k, v] of Object.entries(props as Record<string, any>)) {
      const maybe = checkPair(k, v);
      if (maybe > 0) return maybe;
    }
  }

  return 0;
};

const resolveLineItemCredits = (
  lineItem: any,
  packMap: Map<string, TopupPackConfig>,
  defaultModelKey: string
): ParsedCredits | null => {
  if (!lineItem || typeof lineItem !== "object") return null;

  const variantId = normText(
    lineItem.variant_id || lineItem.variantId || lineItem.variant_id_str || lineItem.variantIdStr || ""
  );
  const quantity = parsePositiveInt(lineItem.quantity || 1);
  if (quantity <= 0) return null;

  const configured = variantId ? packMap.get(variantId) : null;
  let creditsPerUnit: number | null = configured?.creditsPerUnit ?? null;
  const modelKey = configured?.modelKey || defaultModelKey;

  if (!creditsPerUnit || creditsPerUnit <= 0) {
    const bySku = parseCandidateCreditText(lineItem.sku, true);
    const byProperties = parseFromProperties(lineItem.properties);
    const byTitle = parseCandidateCreditText(
      normText(lineItem.name || lineItem.title || lineItem.variant_title || lineItem.product_title),
      true
    );
    creditsPerUnit = bySku || byProperties || byTitle;
  }

  if (!creditsPerUnit || creditsPerUnit <= 0) return null;

  return {
    modelKey,
    quantity,
    credits: Math.floor(creditsPerUnit) * quantity,
  };
};

const hmacValid = (rawBody: Buffer, secret: string, incomingHeader: string | undefined) => {
  if (!secret) return { ok: true, reason: "skipped" };
  if (!incomingHeader) return { ok: false, reason: "missing_signature" };

  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const received = Buffer.from(incomingHeader, "base64");
    if (received.length !== expected.length) return { ok: false, reason: "invalid_signature" };

    const isMatch = timingSafeEqual(received, expected);
    return { ok: isMatch, reason: isMatch ? "ok" : "invalid_signature" };
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
};

const generateClaimCode = async (pool: Pool): Promise<string> => {
  for (;;) {
    const code = `BOTP-${randomBytes(4).toString("hex").toUpperCase()}`;
    const existing = await pool.query("SELECT 1 FROM shopify_topup_claim_codes WHERE claim_code = $1 LIMIT 1", [code]);
    if (!existing.rows.length) return code;
  }
};

const applyPurchasedTokens = async (pool: Pool, userId: number, creditsByModel: Record<string, number>) => {
  for (const [modelKey, creditsRaw] of Object.entries(creditsByModel)) {
    const credits = parsePositiveInt(creditsRaw);
    if (credits <= 0) continue;

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
  }
};

const sumByModel = (items: ParsedCredits[]) => {
  const out: Record<string, number> = {};
  for (const item of items) {
    if (item.credits <= 0) continue;
    const key = normText(item.modelKey) || "local";
    out[key] = (out[key] || 0) + item.credits;
  }
  return out;
};

export function registerShopifyTopupRoutes({
  app,
  pool,
  webhookPath,
  webhookSecret,
  defaultModelKey,
  variantPackConfigJson,
}: RegisterShopifyTopupRoutesDeps): void {
  const packs = parseTopupPackMap(variantPackConfigJson, defaultModelKey);

  app.post(webhookPath, express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""));
    const signature = (req.get("x-shopify-hmac-sha256") || "").trim();
    const topic = (req.get("x-shopify-topic") || "orders/paid").trim();
    const shop = (req.get("x-shopify-shop-domain") || "").trim();

    const sig = hmacValid(rawBody, webhookSecret, signature);
    if (!sig.ok) {
      return res.status(401).json({ ok: false, error: sig.reason });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }

    const orderId = normText(payload?.id || payload?.admin_graphql_api_id || payload?.order_id || payload?.order_number);
    const orderName = normText(payload?.name || payload?.order_name || `#${orderId}`);
    const lineItems = Array.isArray(payload?.line_items) ? payload.line_items : [];

    if (!orderId) {
      return res.status(400).json({ ok: false, error: "missing_order_id" });
    }

    const customerEmail =
      normEmail(payload?.customer?.email) ||
      normEmail(payload?.email) ||
      normEmail(payload?.contact_email) ||
      normEmail(payload?.billing_address?.email) ||
      normEmail(payload?.shipping_address?.email) ||
      "";

    const sourceShop =
      shop ||
      normText(payload?.shop_domain || payload?.myshopify_domain || payload?.admin_graphql_api_id || payload?.shop?.myshopify_domain) ;
    const eventTopic = topic;

    const resolvedItems: ParsedCredits[] = lineItems
      .map((lineItem: any) => resolveLineItemCredits(lineItem, packs, defaultModelKey))
      .filter((item): item is ParsedCredits => Boolean(item));

    const creditsByModel = sumByModel(resolvedItems);
    const creditsTotal = Object.values(creditsByModel).reduce((a, b) => a + b, 0);

    const existing = await pool.query(
      `
        SELECT id, status, claim_code, credits_by_model
        FROM shopify_topup_order_events
        WHERE source_shop = $1 AND shop_order_id = $2 AND event_topic = $3
        LIMIT 1
      `,
      [sourceShop, orderId, eventTopic]
    );

    if (existing.rows.length) {
      return res.json({
        ok: true,
        duplicate: true,
        event_id: Number(existing.rows[0].id),
        status: existing.rows[0].status || "received",
        credits_by_model: existing.rows[0].credits_by_model || creditsByModel,
      });
    }

    let eventId: number;
    try {
      const inserted = await pool.query(
        `
          INSERT INTO shopify_topup_order_events (
            source_shop,
            shop_order_id,
            event_topic,
            shop_order_name,
            customer_email,
            credits_by_model,
            raw_payload,
            status,
            claim_code,
            created_at,
            updated_at,
            processed_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, now(), now(), now()
          )
          RETURNING id
        `,
        [
          sourceShop,
          orderId,
          eventTopic,
          orderName,
          customerEmail,
          JSON.stringify(creditsByModel),
          JSON.stringify(payload),
          creditsTotal > 0 ? "received" : "no_eligible_items",
          null,
        ]
      );
      eventId = Number(inserted.rows[0]?.id);
    } catch (error: any) {
      return res
        .status(500)
        .json({ ok: false, error: "event_insert_failed", detail: String(error?.message || error) });
    }

    if (creditsTotal <= 0) {
      return res.json({
        ok: true,
        event_id: eventId,
        status: "no_eligible_items",
        credits_by_model: {},
      });
    }

    if (!customerEmail) {
      await pool.query(
        `
          UPDATE shopify_topup_order_events
          SET status = 'missing_customer_email', updated_at = now(), processed_at = now()
          WHERE id = $1
        `,
        [eventId]
      );
      return res.status(200).json({
        ok: false,
        event_id: eventId,
        status: "missing_customer_email",
        credits_by_model: creditsByModel,
      });
    }

    const userLookup = await pool.query("SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1", [customerEmail]);
    const matchedUserId = userLookup.rows.length ? Number(userLookup.rows[0].id) : null;

    if (matchedUserId) {
      try {
        await applyPurchasedTokens(pool, matchedUserId, creditsByModel);
        await pool.query(
          `
            UPDATE shopify_topup_order_events
            SET user_id = $1,
                status = 'auto_credited',
                updated_at = now(),
                processed_at = now()
            WHERE id = $2
          `,
          [matchedUserId, eventId]
        );

        return res.json({
          ok: true,
          event_id: eventId,
          status: "auto_credited",
          user_id: matchedUserId,
          credits_by_model: creditsByModel,
        });
      } catch (error: any) {
        await pool.query(
          `
            UPDATE shopify_topup_order_events
            SET status = 'error',
                last_error = $1,
                updated_at = now(),
                processed_at = now()
            WHERE id = $2
          `,
          [String(error?.message || error), eventId]
        );
        return res.status(500).json({ ok: false, event_id: eventId, error: "credit_apply_failed" });
      }
    }

    try {
      const claimCode = await generateClaimCode(pool);
      await pool.query(
        `
          INSERT INTO shopify_topup_claim_codes (
            claim_code,
            order_event_id,
            email,
            credits_by_model,
            status,
            raw_payload,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4::jsonb, $5, $6::jsonb, now(), now()
          )
        `,
        [claimCode, eventId, customerEmail, JSON.stringify(creditsByModel), "pending", JSON.stringify(payload)]
      );

      await pool.query(
        `
          UPDATE shopify_topup_order_events
          SET claim_code = $1,
              status = 'pending_user_claim',
              updated_at = now(),
              processed_at = now()
          WHERE id = $2
        `,
        [claimCode, eventId]
      );

      return res.json({
        ok: true,
        event_id: eventId,
        status: "pending_user_claim",
        claim_code: claimCode,
        email: customerEmail,
        credits_by_model: creditsByModel,
      });
    } catch (error: any) {
      await pool.query(
        `
          UPDATE shopify_topup_order_events
          SET status = 'error',
              last_error = $1,
              updated_at = now(),
              processed_at = now()
          WHERE id = $2
        `,
        [String(error?.message || error), eventId]
      );
      return res.status(500).json({ ok: false, event_id: eventId, error: "claim_create_failed" });
    }
  });

  app.post("/api/shopify/topup/claim", async (req, res) => {
    const user = (req as any).authUser as { id: string; email: string } | undefined;
    if (!user) return res.status(401).json({ ok: false, error: "unauthorized" });

    const claimCode = normText(req.body?.claim_code || req.body?.code || req.body?.tokenCode || "").toUpperCase();
    if (!claimCode) {
      return res.status(400).json({ ok: false, error: "claim_code is required" });
    }

    const claim = await pool.query(
      `
        SELECT id, email, credits_by_model, status
        FROM shopify_topup_claim_codes
        WHERE claim_code = $1
        LIMIT 1
      `,
      [claimCode]
    );

    if (!claim.rows.length) {
      return res.status(404).json({ ok: false, error: "claim_not_found" });
    }

    const row = claim.rows[0];
    if (row.status !== "pending") {
      return res.status(409).json({ ok: false, error: `claim_status_${row.status}` });
    }

    const claimEmail = normEmail(row.email);
    const userEmail = normEmail(user.email);
    if (claimEmail && userEmail && claimEmail !== userEmail) {
      return res.status(403).json({ ok: false, error: "claim_email_mismatch" });
    }

    const creditsByModel = row.credits_by_model && typeof row.credits_by_model === "object" ? row.credits_by_model : {};

    await pool.query("BEGIN");
    try {
      await applyPurchasedTokens(pool, Number(user.id), creditsByModel);
      await pool.query(
        `
          UPDATE shopify_topup_claim_codes
          SET status = 'redeemed',
              redeemed_user_id = $2,
              redeemed_at = now(),
              updated_at = now()
          WHERE id = $1
        `,
        [row.id, Number(user.id)]
      );
      await pool.query("COMMIT");
      return res.json({
        ok: true,
        claim_code: claimCode,
        status: "redeemed",
        user_id: Number(user.id),
        credits_by_model: creditsByModel,
      });
    } catch (error: any) {
      await pool.query("ROLLBACK");
      return res.status(500).json({ ok: false, claim_code: claimCode, error: "claim_redeem_failed" });
    }
  });
}
