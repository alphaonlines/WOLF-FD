# Sales Analysis canonical contract

Sales Analysis is an AlphaHS single-company reporting surface. It does not claim or simulate tenant isolation. Store is part of the canonical sale identity (`store + sale_id`), not a tenant boundary. A future multi-company deployment requires a real company key, database constraints, authorization policy, migrations, and tests; adding a cosmetic `tenant_id` filter is not sufficient.

The delivered-date `/api/sales-analysis/report` response is the only data contract used by the Sales Dashboard. Its summary and rankings cover the complete filtered range. Detail rows are fetched with stable server-side `COUNT`, `LIMIT`, and `OFFSET` pagination. Optional comparisons are disabled in the UI until they can use the same canonical contract.

Cost authority is ordered as follows:

1. Group Report values are the sole automatic authority.
2. An active Admin/Owner manual override may fill a cost gap. Every override records the store/sale/row identity, reason, actor, creation timestamp, and immutable history. Group Report cost always supersedes it.
3. Otherwise cost and profit are unknown and the UI displays `Unavailable`.

Legacy Top Items imports are never treated as cost authority, even when they contain a cost-like column. Mutation endpoints require `module.sales`, an Admin/Owner role, authenticated actor identity, and a same-origin request.

The cost schema is applied by the idempotent `db/2026-08-13-sales-cost-authority.sql` migration during startup bootstrap. The migration creates immutable import provenance, override history, the one-active-override view, and supporting indexes.
