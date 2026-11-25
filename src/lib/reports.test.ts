// @vitest-environment node
import { describe, expect, it } from "vitest";
import { marginOf, monthOf, rollup } from "@/lib/reports";

describe("reports", () => {
  it("groups rows and sums every total, sorted by key", () => {
    const rows = [
      { c: "tin", t: 2, v: 10 },
      { c: "gold", t: 1, v: 50 },
      { c: "tin", t: 3, v: 15 },
    ];
    expect(rollup(rows, (r) => r.c, (r) => ({ tonnes: r.t, value: r.v }))).toEqual([
      { key: "gold", count: 1, totals: { tonnes: 1, value: 50 } },
      { key: "tin", count: 2, totals: { tonnes: 5, value: 25 } },
    ]);
  });

  it("splits expected (ordered) from realized (delivered) margin", () => {
    const m = marginOf({ orderedQuantity: 10, deliveredQuantity: 4, unitPrice: 12, unitCostSnapshot: 10 });
    expect(m).toMatchObject({ revenue: 120, expected: 20, realizedRevenue: 48, realized: 8, unknown: 0 });
  });

  it("flags an order with no cost instead of counting it as pure margin", () => {
    expect(marginOf({ orderedQuantity: 10, deliveredQuantity: 0, unitPrice: 12, unitCostSnapshot: null })).toMatchObject({ revenue: 120, costedRevenue: 0, expected: 0, unknown: 1 });
  });

  it("buckets dates by UTC month", () => {
    expect(monthOf(new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    expect(monthOf(null)).toBe("—");
  });
});
