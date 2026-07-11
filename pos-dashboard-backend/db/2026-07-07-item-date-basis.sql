-- WOLF FD POS written/delivered item basis support
-- Idempotent schema patch. Requires a DB owner for pos_sale_items/pos_sale_items_raw.
-- Do not run automatically from the importer; apply only after production approval.

BEGIN;

ALTER TABLE pos_sale_items_raw
  ADD COLUMN IF NOT EXISTS date_basis TEXT;

ALTER TABLE pos_sale_items
  ADD COLUMN IF NOT EXISTS date_basis TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_date_basis_sale_id
  ON pos_sale_items(date_basis, sale_id);

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_date_basis_sale_date
  ON pos_sale_items(date_basis, sale_date);

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_date_basis_delivery
  ON pos_sale_items(date_basis, delivery_confirmed_date);

CREATE INDEX IF NOT EXISTS idx_pos_sale_items_raw_date_basis_sale_id
  ON pos_sale_items_raw(date_basis, sale_id);

COMMIT;
