import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Sales Analysis cost authority schema", () => {
  it("ships an idempotent Group-only authority migration with immutable override history", () => {
    const sql = fs.readFileSync(path.resolve(__dirname, "../db/2026-08-13-sales-cost-authority.sql"), "utf8");
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS cost_authority/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS cost_import_batch_id/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS sales_cost_override_history/i);
    expect(sql).toMatch(/CREATE OR REPLACE VIEW sales_cost_override_active/i);
    expect(sql).toMatch(/reason\s+TEXT\s+NOT NULL/i);
    expect(sql).toMatch(/actor_user_id\s+BIGINT\s+NOT NULL/i);
    expect(sql).toMatch(/created_at\s+TIMESTAMPTZ\s+NOT NULL/i);
    expect(sql).toMatch(/superseded_at\s+TIMESTAMPTZ/i);
    expect(sql).toMatch(/prevent_sales_cost_override_history_mutation/i);
    expect(sql).toMatch(/pg_advisory_xact_lock/i);
    expect(sql).toMatch(/OLD\.superseded_at IS NULL[\s\S]*NEW\.superseded_at IS NOT NULL/i);
    expect(sql).toMatch(/NEW\.superseded_at IS DISTINCT FROM OLD\.superseded_at/i);
    expect(sql).toMatch(/cost_authority IN \('group_report'\)/i);
    expect(sql).toMatch(/cost_import_batch_id[\s\S]*cost_imported_at[\s\S]*cost_source_file_sha256/i);
    expect(sql).toMatch(/prevent_sales_cost_provenance_mutation/i);
    expect(sql).toMatch(/OLD\.cost_import_batch_id IS NOT NULL[\s\S]*sales cost import provenance is immutable/i);
    expect(sql).toMatch(/BEFORE DELETE ON pos_sale_items[\s\S]*prevent_sales_cost_provenance_mutation/i);
    expect(sql).toMatch(/OLD\.cost_authority\s*=\s*'group_report'[\s\S]*NEW IS DISTINCT FROM OLD[\s\S]*RAISE EXCEPTION/i);
    expect(sql).toMatch(/sales_cost_group_update_protected[\s\S]*BEFORE UPDATE ON pos_sale_items/i);
    expect(sql).toMatch(/SELECT cost_authority INTO target_authority[\s\S]*FROM pos_sale_items[\s\S]*row_hash\s*=\s*p_row_id[\s\S]*FOR UPDATE/i);
    expect(sql).toMatch(/IF target_authority\s*=\s*'group_report'[\s\S]*RAISE EXCEPTION/i);
    expect(sql).not.toMatch(/REFERENCES\s+users/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS sales_cost_authority_attestations/i);
    expect(sql).toMatch(/prevent_sales_cost_authority_attestation_mutation/i);
    expect(sql).toContain("a98f0bf0d86bfa6c73a665c4b5a73a33");
    expect(sql).toMatch(/actual_rows[^;]*680/i);
    expect(sql).toMatch(/actual_known_rows[^;]*672/i);
    expect(sql).toMatch(/actual_unknown_rows[^;]*8/i);
    for (const frozen of ["423987.48", "194102.96", "229884.52"]) expect(sql).toContain(frozen);
    expect(sql).toMatch(/Group authority attestation mismatch/i);
    expect(sql).toMatch(/import_batch_id\s*=\s*586/i);
    expect(sql).toMatch(/WHERE import_batch_id\s*=\s*586[\s\S]*total_cost IS NOT NULL/i);
    expect(sql).toMatch(/SET cost_authority\s*=\s*'group_report'/i);
    expect(sql).toContain("19960c6a1b0b8df8259854a5c63bfda11a1021882656f0a829e7be258d6d801f");
    expect(sql).not.toContain("6729a6530fa1194d2bb404afa3dd9bc4ab2dd91a4bfd9fc988fb10655de7ec40");
    expect(sql).not.toMatch(/SET cost_authority\s*=\s*NULL/i);
  });

  it("populates immutable provenance only for imported rows that have cost", () => {
    const importer = fs.readFileSync(path.resolve(__dirname, "../importer/import_pos_xlsx.py"), "utf8");
    expect(importer).toMatch(/assert_no_group_authority_replacement/i);
    expect(importer).toMatch(/cost_authority\s*=\s*'group_report'/i);
    expect(importer).toMatch(/sha256/i);
    expect(importer).toMatch(/cost_import_batch_id/i);
    expect(importer).toMatch(/cost_imported_at/i);
    expect(importer).toMatch(/cost_source_file_sha256/i);
    expect(importer).toMatch(/has_cost\s*=\s*row\["total_cost"\]\s+is not None/i);
    expect(importer).toMatch(/cost_import_batch_id\s*=\s*COALESCE\(pos_sale_items\.cost_import_batch_id/i);
    expect(importer).toMatch(/cost_imported_at\s*=\s*COALESCE\(pos_sale_items\.cost_imported_at/i);
    expect(importer).toMatch(/cost_source_file_sha256\s*=\s*COALESCE\(pos_sale_items\.cost_source_file_sha256/i);
  });

  it("fails closed when the mandatory cost migration cannot run", () => {
    const startup = fs.readFileSync(path.resolve(__dirname, "startupBootstrap.ts"), "utf8");
    const server = fs.readFileSync(path.resolve(__dirname, "server.ts"), "utf8");
    const dockerfile = fs.readFileSync(path.resolve(__dirname, "../../Dockerfile.backend"), "utf8");
    expect(dockerfile).toMatch(/COPY\s+--from=builder\s+\/app\/db\s+\.\/db/i);
    expect(startup).toMatch(/if\s*\(\s*!fs\.existsSync\(salesCostMigration\)\s*\)\s*throw new Error/i);
    expect(server).toMatch(/startServer\(\)\.catch\s*\(/i);
    expect(server).not.toMatch(/try\s*\{[\s\S]*?runStartupBootstrap[\s\S]*?catch\s*\([^)]*\)\s*\{[\s\S]*?Failed to ensure startup schema\/state[\s\S]*?\}[\s\S]*?httpServer\.listen/i);
  });
});
