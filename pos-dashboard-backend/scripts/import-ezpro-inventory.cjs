#!/usr/bin/env node
/* Import EZPro View Inventory rows.json into WOLF-FD inventory snapshot tables. */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();
dotenv.config({ path: '/home/alphahs/WOLF-CENTRAL.env' });

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
};

const artifactRoot = path.resolve(getArg('--artifact-root', process.env.EZPRO_INVENTORY_ARTIFACT || ''));
if (!artifactRoot) {
  console.error('Usage: node scripts/import-ezpro-inventory.cjs --artifact-root /path/to/artifact');
  process.exit(2);
}
const rowsPath = path.join(artifactRoot, 'rows.json');
const summaryPath = path.join(artifactRoot, 'summary.json');
if (!fs.existsSync(rowsPath)) {
  console.error(`rows.json not found: ${rowsPath}`);
  process.exit(2);
}

const rows = JSON.parse(fs.readFileSync(rowsPath, 'utf8'));
const summary = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : {};
const first = rows[0] || {};
const manufacturerCode = String(getArg('--manufacturer-code', first.manufacturer_id || summary.manufacturer_id || '37'));
const manufacturerName = String(getArg('--manufacturer-name', first.manufacturer_name || summary.manufacturer_name || 'Best Home Furnishings'));
const catalogSlug = String(getArg('--catalog-slug', 'best'));
const catalogName = String(getArg('--catalog-name', 'Best'));
const scrapedAt = String(getArg('--scraped-at', summary.scraped_at || new Date().toISOString()));

const intVal = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const text = (v) => String(v ?? '').trim();
const norm = (v) => text(v).toUpperCase();
const withoutPillowLocations = (locations) => (Array.isArray(locations) ? locations : [])
  .filter((loc) => loc && !/^PILLOW [12] \(SET\)$/i.test(text(loc.location_name)))
  .map((loc) => ({ location_name: text(loc.location_name), qty: intVal(loc.qty) }))
  .filter((loc) => loc.location_name);

async function ensureSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS ezpro_inventory_snapshots (
    id BIGSERIAL PRIMARY KEY,
    manufacturer_code TEXT NOT NULL,
    manufacturer_name TEXT NOT NULL,
    catalog_manufacturer_slug TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'ezpro_view_inventory_manufacturer',
    artifact_path TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    total_qty_instock_dam INTEGER NOT NULL DEFAULT 0,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ezpro_inventory_snapshots_slug_scraped ON ezpro_inventory_snapshots(catalog_manufacturer_slug, scraped_at DESC, id DESC)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ezpro_inventory_items (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES ezpro_inventory_snapshots(id) ON DELETE CASCADE,
    manufacturer_code TEXT NOT NULL,
    manufacturer_name TEXT NOT NULL,
    catalog_manufacturer_slug TEXT NOT NULL,
    item_number TEXT NOT NULL,
    normalized_item_number TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    finish TEXT NOT NULL DEFAULT '',
    fabric TEXT NOT NULL DEFAULT '',
    pillow_1_set TEXT NOT NULL DEFAULT '',
    pillow_2_set TEXT NOT NULL DEFAULT '',
    qty_instock_dam INTEGER NOT NULL DEFAULT 0,
    qty_reserved INTEGER NOT NULL DEFAULT 0,
    qty_locked INTEGER NOT NULL DEFAULT 0,
    qty_available INTEGER NOT NULL DEFAULT 0,
    qty_onorder INTEGER NOT NULL DEFAULT 0,
    qty_damaged INTEGER NOT NULL DEFAULT 0,
    item_href TEXT NOT NULL DEFAULT '',
    item_url TEXT NOT NULL DEFAULT '',
    item_image_url TEXT NOT NULL DEFAULT '',
    qty_location_href TEXT NOT NULL DEFAULT '',
    qty_location_url TEXT NOT NULL DEFAULT '',
    raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_row_html TEXT NOT NULL DEFAULT ''
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ezpro_inventory_items_snapshot_item ON ezpro_inventory_items(snapshot_id, normalized_item_number)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ezpro_inventory_items_slug_item ON ezpro_inventory_items(catalog_manufacturer_slug, normalized_item_number)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ezpro_inventory_locations (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES ezpro_inventory_snapshots(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES ezpro_inventory_items(id) ON DELETE CASCADE,
    location_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    raw_fields JSONB NOT NULL DEFAULT '{}'::jsonb
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ezpro_inventory_locations_item ON ezpro_inventory_locations(item_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ezpro_inventory_locations_snapshot ON ezpro_inventory_locations(snapshot_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ezpro_inventory_manufacturer_map (
    ezpro_manufacturer_code TEXT PRIMARY KEY,
    ezpro_manufacturer_name TEXT NOT NULL,
    catalog_manufacturer_slug TEXT NOT NULL,
    catalog_manufacturer_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'salesdb',
    user: process.env.PGUSER || 'salesapp',
    password: process.env.PGPASSWORD || 'dev_password_change_me',
  });
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    await client.query('BEGIN');
    await client.query(`INSERT INTO ezpro_inventory_manufacturer_map (ezpro_manufacturer_code, ezpro_manufacturer_name, catalog_manufacturer_slug, catalog_manufacturer_name)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (ezpro_manufacturer_code) DO UPDATE SET ezpro_manufacturer_name=EXCLUDED.ezpro_manufacturer_name, catalog_manufacturer_slug=EXCLUDED.catalog_manufacturer_slug, catalog_manufacturer_name=EXCLUDED.catalog_manufacturer_name, active=TRUE, updated_at=now()`,
      [manufacturerCode, manufacturerName, catalogSlug, catalogName]);
    const totalQty = rows.reduce((sum, row) => sum + intVal(row['Qty InStock+DAM_int'] ?? row.qty_instock_dam ?? row['Qty InStock+DAM']), 0);
    const removed = await client.query(
      `DELETE FROM ezpro_inventory_snapshots
        WHERE manufacturer_code = $1
          AND catalog_manufacturer_slug = $2`,
      [manufacturerCode, catalogSlug]
    );
    const snap = await client.query(`INSERT INTO ezpro_inventory_snapshots (manufacturer_code, manufacturer_name, catalog_manufacturer_slug, artifact_path, row_count, total_qty_instock_dam, scraped_at, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING id`,
      [manufacturerCode, manufacturerName, catalogSlug, artifactRoot, rows.length, totalQty, scrapedAt, JSON.stringify(summary || {})]);
    const snapshotId = snap.rows[0].id;
    let locationCount = 0;
    for (const row of rows) {
      const itemNumber = text(row.item_number || row['Item#']);
      if (!itemNumber) continue;
      const item = await client.query(`INSERT INTO ezpro_inventory_items (
        snapshot_id, manufacturer_code, manufacturer_name, catalog_manufacturer_slug, item_number, normalized_item_number,
        description, finish, fabric, pillow_1_set, pillow_2_set, qty_instock_dam, qty_reserved, qty_locked, qty_available,
        qty_onorder, qty_damaged, item_href, item_url, item_image_url, qty_location_href, qty_location_url, raw_fields, raw_row_html
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24) RETURNING id`, [
        snapshotId, manufacturerCode, manufacturerName, catalogSlug, itemNumber, norm(itemNumber),
        text(row.description || row.Description), text(row.finish || row.Finish), text(row.fabric || row.Fabric),
        text(row['PILLOW 1 (SET)']), text(row['PILLOW 2 (SET)']),
        intVal(row['Qty InStock+DAM_int'] ?? row['Qty InStock+DAM']), intVal(row['Qty Reserved_int'] ?? row['Qty Reserved']),
        intVal(row['Qty Locked_int'] ?? row['Qty Locked']), intVal(row['Qty Available_int'] ?? row['Qty Available']),
        intVal(row['Qty Onorder_int'] ?? row['Qty Onorder']), intVal(row['Qty Damaged_int'] ?? row['Qty Damaged']),
        text(row.item_href), text(row.item_url), text(row.item_image_url), text(row['Qty InStock+DAM_href']), text(row['Qty InStock+DAM_url']),
        JSON.stringify(row), text(row.raw_row_html)
      ]);
      const itemId = item.rows[0].id;
      const locations = withoutPillowLocations(row.location_detail && row.location_detail.locations);
      for (const loc of locations) {
        await client.query(`INSERT INTO ezpro_inventory_locations (snapshot_id, item_id, location_name, qty, raw_fields)
          VALUES ($1,$2,$3,$4,$5::jsonb)`, [snapshotId, itemId, loc.location_name, loc.qty, JSON.stringify(loc)]);
        locationCount += 1;
      }
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ ok: true, snapshotId, rows: rows.length, locations: locationCount, totalQty, replacedSnapshots: removed.rowCount, artifactRoot }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => { console.error(error.stack || String(error)); process.exit(1); });
