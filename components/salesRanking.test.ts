import { describe, expect, it } from "vitest";
import { rankCanonicalSeries } from "./salesRanking";

describe("canonical Sales ranking", () => {
  const rows = [
    { label: "High dollars", sales: 1000, quantity: 1 },
    { label: "High units", sales: 10, quantity: 20 },
    { label: "Middle", sales: 500, quantity: 5 },
  ];

  it("ranks the full set by the selected metric before truncating", () => {
    expect(rankCanonicalSeries(rows, "qty", 2).map((row) => row.label)).toEqual(["High units", "Middle"]);
    expect(rankCanonicalSeries(rows, "sales", 2).map((row) => row.label)).toEqual(["High dollars", "Middle"]);
  });
});
