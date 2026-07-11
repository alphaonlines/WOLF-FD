"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCrmQuoteRoutes = registerCrmQuoteRoutes;
const crypto_1 = require("crypto");
function normalizePhone(value) {
    const digits = value.replace(/\D+/g, "");
    if (digits.length <= 10)
        return digits;
    return digits.slice(-10);
}
function escapeLikePattern(value) {
    return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
function trimText(value) {
    return typeof value === "string" ? value.trim() : "";
}
function parseNumeric(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num))
        return null;
    return num;
}
function parseInteger(value) {
    if (value === null || value === undefined || value === "")
        return null;
    const num = Number(value);
    if (!Number.isFinite(num))
        return null;
    const intValue = Math.trunc(num);
    if (!Number.isInteger(intValue))
        return null;
    return intValue;
}
function parseDateOnly(value) {
    if (!value || typeof value !== "string")
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
function quoteDatePlusDays(days) {
    const base = new Date();
    const end = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    return end.toISOString().slice(0, 10);
}
function safeJson(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    return value;
}
function withLimit(sql, limit = 20) {
    const trimmed = sql.trim().replace(/;$/, "");
    return `${trimmed} LIMIT ${limit}`;
}
function mapSalesOrderMatch(row) {
    return {
        sale_id: String(row.sale_id ?? ""),
        customer_name: String(row.customer_name ?? ""),
        phone: String(row.phone ?? ""),
        grand_total: row.grand_total ?? null,
        sale_date: row.sale_date ? String(row.sale_date).slice(0, 10) : null,
        match_confidence: String(row.match_confidence ?? "high"),
    };
}
function mapUpsVisitMatch(row) {
    return {
        id: String(row.id ?? ""),
        customer: String(row.customer ?? ""),
        phone: String(row.phone ?? ""),
        email: String(row.email ?? ""),
        store: String(row.store ?? "FD7"),
        started_at: row.started_at ? String(row.started_at).slice(0, 19).replace("T", " ") : null,
        match_confidence: String(row.match_confidence ?? "high"),
    };
}
function registerCrmQuoteRoutes(app, pool) {
    const handleCreateQuote = async (req, res) => {
        const user = req.authUser;
        if (!user || !user.id) {
            return res.status(401).json({ error: "unauthorized" });
        }
        const customerBody = req.body?.customer ?? {};
        const quoteBody = req.body?.quote ?? {};
        const firstName = trimText(customerBody?.first_name);
        const lastName = trimText(customerBody?.last_name);
        if (!firstName || !lastName) {
            return res.status(400).json({ error: "first_name and last_name are required" });
        }
        const rawPhone = trimText(customerBody?.phone);
        const rawEmail = trimText(customerBody?.email).toLowerCase();
        const normalizedPhone = normalizePhone(rawPhone);
        if (!normalizedPhone && !rawEmail) {
            return res.status(400).json({ error: "phone or email is required" });
        }
        const store = trimText(quoteBody?.store) || "FD7";
        const sourceContext = trimText(quoteBody?.source_context);
        const salesOrderNotes = trimText(quoteBody?.sales_order_notes);
        const quoteSnapshot = safeJson(quoteBody?.quote_snapshot);
        const quoteTotal = parseNumeric(quoteBody?.quote_total);
        const subtotalBeforeTax = parseNumeric(quoteBody?.subtotal_before_tax);
        const taxAmount = parseNumeric(quoteBody?.tax_amount);
        const discountTotal = parseNumeric(quoteBody?.discount_total);
        const quoteValidDays = parseInteger(quoteBody?.quote_valid_days);
        const quoteValidUntil = parseDateOnly(quoteBody?.quote_valid_until) ||
            (quoteValidDays !== null ? quoteDatePlusDays(quoteValidDays) : null);
        const userId = Number(user.id);
        const createdByUserId = Number.isFinite(userId) && userId > 0 ? userId : null;
        const createdByName = trimText(user.name) || trimText(user.email) || "dashboard-user";
        const createdByEmail = trimText(user.email);
        const customerName = `${firstName} ${lastName}`.trim();
        const customerId = `cust-${(0, crypto_1.randomUUID)()}`;
        const quoteId = `quote-${(0, crypto_1.randomUUID)()}`;
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            let resolvedCustomerId = "";
            if (normalizedPhone) {
                const byPhone = await client.query(withLimit(`
              SELECT id, name, phone, email
              FROM crm_customers
              WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
              ORDER BY updated_at DESC, created_at DESC
            `, 1), [normalizedPhone]);
                const first = byPhone.rows[0];
                if (first) {
                    resolvedCustomerId = String(first.id || "");
                }
            }
            if (!resolvedCustomerId && rawEmail) {
                const byEmail = await client.query(withLimit(`
              SELECT id, name, phone, email
              FROM crm_customers
              WHERE lower(COALESCE(email, '')) = lower($1)
              ORDER BY updated_at DESC, created_at DESC
            `, 1), [rawEmail]);
                const first = byEmail.rows[0];
                if (first) {
                    resolvedCustomerId = String(first.id || "");
                }
            }
            const finalCustomerId = resolvedCustomerId || customerId;
            const customerUpsert = await client.query(`
          INSERT INTO crm_customers (
            id,
            name,
            phone,
            email,
            store,
            channel,
            source,
            owner,
            owner_user_id,
            stage,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'SMS', 'smart_calc', 'Unassigned', NULL, 'Quoted', now(), now())
          ON CONFLICT (id)
          DO UPDATE SET
            name = EXCLUDED.name,
            phone = CASE WHEN COALESCE(EXCLUDED.phone, '') <> '' THEN EXCLUDED.phone ELSE crm_customers.phone END,
            email = CASE WHEN COALESCE(EXCLUDED.email, '') <> '' THEN EXCLUDED.email ELSE crm_customers.email END,
            store = CASE WHEN COALESCE(NULLIF(EXCLUDED.store, ''), '') <> '' THEN EXCLUDED.store ELSE crm_customers.store END,
            source = CASE WHEN COALESCE(NULLIF(EXCLUDED.source, ''), '') <> '' THEN EXCLUDED.source ELSE crm_customers.source END,
            owner_user_id = COALESCE(crm_customers.owner_user_id, EXCLUDED.owner_user_id),
            updated_at = now()
          RETURNING id, name, phone, email
        `, [finalCustomerId, customerName, rawPhone, rawEmail, store]);
            const customer = customerUpsert.rows[0] || {
                id: finalCustomerId,
                name: customerName,
                phone: rawPhone,
                email: rawEmail,
            };
            const salesOrderRows = normalizedPhone
                ? await client.query(`
              SELECT sale_id, customer_name, phone, grand_total, sale_date
              FROM pos_sales
              WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
              ORDER BY sale_date DESC
              LIMIT 20
            `, [normalizedPhone])
                : { rows: [] };
            const salesOrders = salesOrderRows.rows.map((row) => ({
                ...mapSalesOrderMatch(row),
                match_confidence: "high",
            }));
            const upsWhere = [];
            const upsParams = [];
            if (normalizedPhone) {
                upsParams.push(normalizedPhone);
                upsWhere.push(`right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $${upsParams.length}`);
            }
            if (rawEmail) {
                upsParams.push(rawEmail);
                upsWhere.push(`lower(COALESCE(email, '')) = lower($${upsParams.length})`);
            }
            const upsVisitRows = upsWhere.length
                ? await client.query(`
              SELECT id, store, customer, phone, email, started_at
              FROM crm_ups_history
              WHERE ${upsWhere.join(" OR ")}
              ORDER BY started_at DESC
              LIMIT 20
            `, upsParams)
                : { rows: [] };
            let upsVisits = upsVisitRows.rows.map((row) => ({
                ...mapUpsVisitMatch(row),
                match_confidence: "high",
            }));
            if (!upsVisits.length) {
                const namePrefix = `%${escapeLikePattern(firstName.toLowerCase())}%`;
                const nameSuffix = `%${escapeLikePattern(lastName.toLowerCase())}%`;
                const upsNameRows = await client.query(`
            SELECT id, store, customer, phone, email, started_at
            FROM crm_ups_history
            WHERE (lower(COALESCE(customer, '')) LIKE $1 ESCAPE '\\' OR lower(COALESCE(customer, '')) LIKE $2 ESCAPE '\\')
            ORDER BY started_at DESC
            LIMIT 5
          `, [namePrefix, nameSuffix]);
                upsVisits = [
                    ...upsVisits,
                    ...upsNameRows.rows.map((row) => ({
                        ...mapUpsVisitMatch(row),
                        match_confidence: "low",
                    })),
                ];
            }
            const quoteInsert = await client.query(`
          INSERT INTO crm_customer_quotes (
            id,
            customer_id,
            customer_name,
            first_name,
            last_name,
            phone,
            email,
            store,
            source,
            source_context,
            quote_total,
            subtotal_before_tax,
            tax_amount,
            discount_total,
            quote_valid_days,
            quote_valid_until,
            sales_order_notes,
            quote_snapshot,
            created_by_user_id,
            created_by_name,
            created_by_email,
            printed_at,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'smart_calc', $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::bigint, $19, $20, NULL, now(), now())
          RETURNING id, customer_id, quote_total, quote_valid_until
        `, [
                quoteId,
                finalCustomerId,
                customerName,
                firstName,
                lastName,
                rawPhone,
                rawEmail,
                store,
                sourceContext,
                quoteTotal,
                subtotalBeforeTax,
                taxAmount,
                discountTotal,
                quoteValidDays,
                quoteValidUntil,
                salesOrderNotes,
                quoteSnapshot,
                createdByUserId,
                createdByName,
                createdByEmail,
            ]);
            const quote = quoteInsert.rows[0] || {
                id: quoteId,
                customer_id: finalCustomerId,
                quote_total: quoteTotal,
                quote_valid_until: quoteValidUntil,
            };
            await client.query("COMMIT");
            return res.status(201).json({
                quote: {
                    id: String(quote.id ?? quoteId),
                    customer_id: String(quote.customer_id ?? finalCustomerId),
                    quote_total: quote.quote_total ?? null,
                    quote_valid_until: quote.quote_valid_until ? String(quote.quote_valid_until).slice(0, 10) : null,
                },
                customer: {
                    id: String(customer.id || finalCustomerId),
                    name: String(customer.name || customerName),
                    phone: String(customer.phone || rawPhone),
                    email: String(customer.email || rawEmail),
                },
                matches: {
                    salesOrders,
                    upsVisits,
                },
            });
        }
        catch (error) {
            try {
                await client.query("ROLLBACK");
            }
            catch {
                // ignore rollback failure for response shape consistency
            }
            return res.status(500).json({ error: "unable to persist quote" });
        }
        finally {
            client.release();
        }
    };
    app.post("/api/crm/quotes", handleCreateQuote);
    app.post("/crm/quotes", handleCreateQuote);
}
//# sourceMappingURL=crmQuoteRoutes.js.map