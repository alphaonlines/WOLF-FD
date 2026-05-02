import { describe, expect, it } from "vitest";
import { buildQualifiedPro1stSql } from "./pro1stSql";

describe("pro1st SQL matching", () => {
  it("matches current Protection 1st/Max Elite import labels", () => {
    const sql = buildQualifiedPro1stSql("i.");

    expect(sql).toContain("%protection 1st%");
    expect(sql).toContain("%protection programs%");
    expect(sql).toContain("%max_elite%");
  });

  it("keeps bedding foundation exclusions in place", () => {
    const sql = buildQualifiedPro1stSql("i.");

    expect(sql).toContain("%mattress%");
    expect(sql).toContain("%adjustable base%");
    expect(sql).toContain("%bunkie board%");
  });
});
