-- Idempotent AlphaHS single-company Sales Analysis cost authority schema.
-- Group Report is the sole automatic authority. Import provenance is retained
-- for audit only and never makes a legacy or Top Items cost authoritative.
-- Audited overrides are lower precedence and fill only Group-cost gaps.
BEGIN;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS cost_authority TEXT;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS cost_import_batch_id BIGINT;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS cost_imported_at TIMESTAMPTZ;
ALTER TABLE pos_sale_items ADD COLUMN IF NOT EXISTS cost_source_file_sha256 TEXT;

ALTER TABLE pos_sale_items DROP CONSTRAINT IF EXISTS pos_sale_items_cost_authority_check;
ALTER TABLE pos_sale_items ADD CONSTRAINT pos_sale_items_cost_authority_check
  CHECK (cost_authority IS NULL OR cost_authority IN ('group_report')) NOT VALID;

ALTER TABLE pos_sale_items DROP CONSTRAINT IF EXISTS pos_sale_items_cost_provenance_check;
ALTER TABLE pos_sale_items ADD CONSTRAINT pos_sale_items_cost_provenance_check CHECK (
  (cost_import_batch_id IS NULL AND cost_imported_at IS NULL AND cost_source_file_sha256 IS NULL)
  OR
  (total_cost IS NOT NULL AND cost_import_batch_id IS NOT NULL AND cost_imported_at IS NOT NULL
    AND cost_source_file_sha256 ~ '^[0-9a-f]{64}$')
) NOT VALID;

CREATE OR REPLACE FUNCTION prevent_sales_cost_provenance_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.cost_authority = 'group_report' THEN
      RAISE EXCEPTION 'Group-authoritative sales cost rows cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.cost_authority = 'group_report' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Group-authoritative sales cost rows are immutable';
  END IF;
  IF OLD.cost_import_batch_id IS NOT NULL AND
     (NEW.cost_import_batch_id IS DISTINCT FROM OLD.cost_import_batch_id
      OR NEW.cost_imported_at IS DISTINCT FROM OLD.cost_imported_at
      OR NEW.cost_source_file_sha256 IS DISTINCT FROM OLD.cost_source_file_sha256) THEN
    RAISE EXCEPTION 'sales cost import provenance is immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_cost_provenance_immutable ON pos_sale_items;
CREATE TRIGGER sales_cost_provenance_immutable
  BEFORE UPDATE OF cost_import_batch_id,cost_imported_at,cost_source_file_sha256 ON pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION prevent_sales_cost_provenance_mutation();
DROP TRIGGER IF EXISTS sales_cost_group_update_protected ON pos_sale_items;
CREATE TRIGGER sales_cost_group_update_protected
  BEFORE UPDATE ON pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION prevent_sales_cost_provenance_mutation();
DROP TRIGGER IF EXISTS sales_cost_group_delete_protected ON pos_sale_items;
CREATE TRIGGER sales_cost_group_delete_protected
  BEFORE DELETE ON pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION prevent_sales_cost_provenance_mutation();

CREATE TABLE IF NOT EXISTS sales_cost_override_history (
  id BIGSERIAL PRIMARY KEY,
  store TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  row_id TEXT NOT NULL,
  total_cost NUMERIC(18,2) NOT NULL CHECK (total_cost >= 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  -- Authentication is stored outside salesdb, so retain the immutable actor ID
  -- without an invalid cross-database foreign key.
  actor_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_cost_override_one_active
  ON sales_cost_override_history(store,sale_id,row_id) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_cost_override_history_lookup
  ON sales_cost_override_history(store,sale_id,row_id,created_at DESC,id DESC);

CREATE OR REPLACE FUNCTION prevent_sales_cost_override_history_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.store IS DISTINCT FROM OLD.store OR NEW.sale_id IS DISTINCT FROM OLD.sale_id
     OR NEW.row_id IS DISTINCT FROM OLD.row_id OR NEW.total_cost IS DISTINCT FROM OLD.total_cost
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.superseded_at IS DISTINCT FROM OLD.superseded_at
         AND NOT (OLD.superseded_at IS NULL AND NEW.superseded_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'sales cost override history is immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_cost_override_history_immutable ON sales_cost_override_history;
CREATE TRIGGER sales_cost_override_history_immutable BEFORE UPDATE OR DELETE ON sales_cost_override_history
  FOR EACH ROW EXECUTE FUNCTION prevent_sales_cost_override_history_mutation();

CREATE OR REPLACE FUNCTION replace_sales_cost_override(
  p_store TEXT, p_sale_id TEXT, p_row_id TEXT, p_total_cost NUMERIC, p_reason TEXT, p_actor_user_id BIGINT
) RETURNS sales_cost_override_history AS $$
DECLARE
  inserted sales_cost_override_history;
  target_authority TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store || chr(31) || p_sale_id || chr(31) || p_row_id, 0));
  SELECT cost_authority INTO target_authority
    FROM pos_sale_items
    WHERE location=p_store AND sale_id=p_sale_id AND row_hash=p_row_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sales cost override target does not exist';
  END IF;
  IF target_authority = 'group_report' THEN
    RAISE EXCEPTION 'Group-authoritative sales cost cannot be overridden';
  END IF;
  UPDATE sales_cost_override_history SET superseded_at = now()
    WHERE store=p_store AND sale_id=p_sale_id AND row_id=p_row_id AND superseded_at IS NULL;
  INSERT INTO sales_cost_override_history(store,sale_id,row_id,total_cost,reason,actor_user_id)
    VALUES(p_store,p_sale_id,p_row_id,p_total_cost,p_reason,p_actor_user_id) RETURNING * INTO inserted;
  RETURN inserted;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW sales_cost_override_active AS
  SELECT id,store,sale_id,row_id,total_cost,reason,actor_user_id,created_at,superseded_at
  FROM sales_cost_override_history WHERE superseded_at IS NULL;

CREATE OR REPLACE FUNCTION supersede_override_when_group_cost_arrives() RETURNS trigger AS $$
BEGIN
  IF NEW.cost_authority = 'group_report' AND
     (TG_OP = 'INSERT' OR OLD.cost_authority IS DISTINCT FROM NEW.cost_authority) THEN
    UPDATE sales_cost_override_history SET superseded_at = now()
      WHERE store=NEW.location AND sale_id=NEW.sale_id AND row_id=NEW.row_hash AND superseded_at IS NULL;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_cost_group_supersedes_override ON pos_sale_items;
CREATE TRIGGER sales_cost_group_supersedes_override
  AFTER INSERT OR UPDATE OF cost_authority ON pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION supersede_override_when_group_cost_arrives();

CREATE TABLE IF NOT EXISTS sales_cost_authority_attestations (
  package_sha256 TEXT PRIMARY KEY CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  rowset_md5 TEXT NOT NULL CHECK (rowset_md5 ~ '^[0-9a-f]{32}$'),
  row_count INTEGER NOT NULL,
  known_cost_row_count INTEGER NOT NULL,
  unknown_cost_row_count INTEGER NOT NULL,
  known_cost_sales NUMERIC(18,2) NOT NULL,
  total_cost NUMERIC(18,2) NOT NULL,
  total_profit NUMERIC(18,2) NOT NULL,
  attested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION prevent_sales_cost_authority_attestation_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'sales cost authority attestations are immutable';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS sales_cost_authority_attestation_immutable ON sales_cost_authority_attestations;
CREATE TRIGGER sales_cost_authority_attestation_immutable
  BEFORE UPDATE OR DELETE ON sales_cost_authority_attestations
  FOR EACH ROW EXECUTE FUNCTION prevent_sales_cost_authority_attestation_mutation();

-- Backfill only the validated July adapter batch whose costs were joined from
-- the audited Group Report digest below. Its 672 non-null costs are Group
-- authority; the eight null-cost rows intentionally remain unknown.
DO $$
DECLARE
  actual_rows INTEGER;
  actual_known_rows INTEGER;
  actual_unknown_rows INTEGER;
  actual_known_sales NUMERIC(18,2);
  actual_cost NUMERIC(18,2);
  actual_profit NUMERIC(18,2);
  actual_rowset_md5 TEXT;
BEGIN
  SELECT count(*)::integer,
         count(*) FILTER (WHERE total_cost IS NOT NULL)::integer,
         count(*) FILTER (WHERE total_cost IS NULL)::integer,
         COALESCE(round(sum(total_sale_price) FILTER (WHERE total_cost IS NOT NULL),2),0),
         COALESCE(round(sum(total_cost),2),0),
         COALESCE(round(sum(total_profit) FILTER (WHERE total_cost IS NOT NULL),2),0),
         COALESCE(md5(string_agg(concat_ws(chr(31),coalesce(location,''),coalesce(sale_id,''),coalesce(row_hash,''),
           coalesce(total_sale_price::text,''),coalesce(total_cost::text,''),coalesce(total_profit::text,'')),
           chr(30) ORDER BY coalesce(location,''),coalesce(sale_id,''),coalesce(row_hash,''))), '')
  INTO actual_rows,actual_known_rows,actual_unknown_rows,actual_known_sales,actual_cost,actual_profit,actual_rowset_md5
  FROM pos_sale_items
  WHERE import_batch_id=586
    AND delivery_confirmed_date >= DATE '2026-07-01'
    AND delivery_confirmed_date < DATE '2026-08-01';

  IF actual_rows <> 0 THEN
    IF actual_rows <> 680 OR actual_known_rows <> 672 OR actual_unknown_rows <> 8
       OR actual_known_sales <> 423987.48 OR actual_cost <> 194102.96 OR actual_profit <> 229884.52
       OR actual_rowset_md5 <> 'a98f0bf0d86bfa6c73a665c4b5a73a33' THEN
      RAISE EXCEPTION 'Group authority attestation mismatch';
    END IF;
    INSERT INTO sales_cost_authority_attestations(
      package_sha256,rowset_md5,row_count,known_cost_row_count,unknown_cost_row_count,known_cost_sales,total_cost,total_profit
    ) VALUES (
      '19960c6a1b0b8df8259854a5c63bfda11a1021882656f0a829e7be258d6d801f',actual_rowset_md5,
      actual_rows,actual_known_rows,actual_unknown_rows,actual_known_sales,actual_cost,actual_profit
    ) ON CONFLICT (package_sha256) DO NOTHING;
  END IF;
END $$;

UPDATE pos_sale_items
SET cost_authority = 'group_report',
    cost_import_batch_id = import_batch_id,
    cost_imported_at = COALESCE(cost_imported_at, now()),
    cost_source_file_sha256 = '19960c6a1b0b8df8259854a5c63bfda11a1021882656f0a829e7be258d6d801f'
WHERE import_batch_id = 586
  AND delivery_confirmed_date >= DATE '2026-07-01'
  AND delivery_confirmed_date < DATE '2026-08-01'
  AND total_cost IS NOT NULL;

ALTER TABLE pos_sale_items VALIDATE CONSTRAINT pos_sale_items_cost_authority_check;
ALTER TABLE pos_sale_items VALIDATE CONSTRAINT pos_sale_items_cost_provenance_check;
COMMIT;
