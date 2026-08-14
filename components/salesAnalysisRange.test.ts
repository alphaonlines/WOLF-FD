import { describe, expect, it } from "vitest";
import { latestDeliveredRange } from "./salesAnalysisRange";

describe("Sales Analysis latest delivered month", () => {
  it("labels an older newest month Latest available month", () => {
    expect(latestDeliveredRange("2026-07-18", "2026-08-13")).toEqual({ start: "2026-07-01", endInclusive: "2026-07-18", label: "Latest available month" });
  });

  it("uses true local month to date when newest data is current", () => {
    expect(latestDeliveredRange("2026-08-12", "2026-08-13")).toEqual({ start: "2026-08-01", endInclusive: "2026-08-13", label: "Month to date" });
  });

  it("returns null when no delivered data exists", () => {
    expect(latestDeliveredRange(null, "2026-08-13")).toBeNull();
  });
});
