#!/usr/bin/env bash
set -euo pipefail

# Print non-secret row-count verification for the FD Postgres database.
# Required environment variables must already be set by the operator:
# PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD.

: "${PGHOST:?PGHOST is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGUSER:?PGUSER is required}"
export PGPORT="${PGPORT:-5432}"

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
SELECT 'crm_customers' AS table_name, COUNT(*)::bigint AS rows FROM crm_customers
UNION ALL SELECT 'pos_sales', COUNT(*)::bigint FROM pos_sales
UNION ALL SELECT 'pos_sale_items', COUNT(*)::bigint FROM pos_sale_items
UNION ALL SELECT 'manufacturer_catalog_items', COUNT(*)::bigint FROM manufacturer_catalog_items
UNION ALL SELECT 'manufacturer_pricebook_uploads', COUNT(*)::bigint FROM manufacturer_pricebook_uploads
ORDER BY table_name;

SELECT 'pos_sales_range' AS check_name, MIN(sale_date)::text AS min_value, MAX(sale_date)::text AS max_value FROM pos_sales;
SELECT 'pos_sale_items_range' AS check_name, MIN(sale_date)::text AS min_value, MAX(sale_date)::text AS max_value FROM pos_sale_items;
SQL
