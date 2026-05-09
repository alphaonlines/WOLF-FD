import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("UPS Option B backend persistence", () => {
  const routes = readFileSync(join(__dirname, "routes", "crmRoutesV2.ts"), "utf8");
  const bootstrap = readFileSync(join(__dirname, "startupBootstrap.ts"), "utf8");

  it("bootstraps phone/email columns on UPS active and history tables", () => {
    expect(bootstrap).toContain("ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS phone TEXT");
    expect(bootstrap).toContain("ALTER TABLE crm_ups_active_customers ADD COLUMN IF NOT EXISTS email TEXT");
    expect(bootstrap).toContain("ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS phone TEXT");
    expect(bootstrap).toContain("ALTER TABLE crm_ups_history ADD COLUMN IF NOT EXISTS email TEXT");
  });

  it("returns and persists phone/email through queue start, active update, and history", () => {
    expect(routes).toContain("'phone', ac.phone");
    expect(routes).toContain("'email', ac.email");
    expect(routes).toContain("h.phone");
    expect(routes).toContain("h.email");
    expect(routes).toContain("fields.push(`phone = $");
    expect(routes).toContain("fields.push(`email = $");
    expect(routes).toContain("historyFields.push(`phone = $");
    expect(routes).toContain("historyFields.push(`email = $");
  });
});
