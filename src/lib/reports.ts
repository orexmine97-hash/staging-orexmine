import { prisma } from "@/lib/prisma";

// Reporting (FRD FR-64–67). Each report loads flat rows, then rollup() groups
// them by the chosen dimension. ponytail: grouping runs in JS over the period's
// rows — move to SQL GROUP BY when a period holds tens of thousands of rows.

export type Totals = Record<string, number>;
export type Group = { key: string; count: number; totals: Totals };

export function rollup<T>(items: T[], key: (t: T) => string, sums: (t: T) => Totals): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const k = key(item);
    const g = groups.get(k) ?? { key: k, count: 0, totals: {} };
    for (const [name, v] of Object.entries(sums(item))) g.totals[name] = (g.totals[name] ?? 0) + v;
    g.count++;
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export const monthOf = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "—");
export const gradeOf = (g: unknown) => (g == null ? "—" : `${Number(g).toFixed(1)}%`);
const num = (v: unknown) => (v == null ? 0 : Number(v));

export type Period = { from: Date; to: Date }; // to is exclusive

export const DIMENSIONS = {
  procurement: ["miner", "commodity", "grade", "location", "period"],
  sales: ["buyer", "commodity", "grade", "location", "period"],
  inventory: ["commodity", "grade", "batch", "status", "location"],
  margin: ["batch", "order", "commodity", "period"],
} as const;
export type Report = keyof typeof DIMENSIONS;
export type Dimension<R extends Report> = (typeof DIMENSIONS)[R][number];

// FR-64: accepted (QC-passed) deliveries, valued at the PO price.
export async function procurementReport(period: Period, by: Dimension<"procurement">) {
  const rows = await prisma.delivery.findMany({
    where: { status: "VERIFIED", receivedAt: { gte: period.from, lt: period.to } },
    include: {
      purchaseOrder: { include: { miner: { include: { organization: { select: { name: true } } } } } },
      assays: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const key = {
    miner: (d: (typeof rows)[number]) => d.purchaseOrder.miner.organization.name,
    commodity: (d: (typeof rows)[number]) => d.purchaseOrder.commodity,
    grade: (d: (typeof rows)[number]) => gradeOf(d.assays[0]?.testedGrade ?? d.declaredGrade),
    location: (d: (typeof rows)[number]) => d.custodyLocation ?? "—",
    period: (d: (typeof rows)[number]) => monthOf(d.receivedAt),
  }[by];
  return rollup(rows, key, (d) => {
    const qty = num(d.verifiedQuantity);
    return { tonnes: qty, value: qty * num(d.purchaseOrder.unitPrice) };
  });
}

// Confirmed sales orders in the period (both FR-65 and FR-67 read these).
function confirmedOrders(period: Period) {
  return prisma.salesOrder.findMany({
    where: { status: { notIn: ["DRAFT", "CANCELLED"] }, confirmedAt: { gte: period.from, lt: period.to } },
    include: { batch: true, buyer: { include: { organization: { select: { name: true } } } } },
  });
}
type Order = Awaited<ReturnType<typeof confirmedOrders>>[number];

// FR-65: ordered tonnes and value at the frozen SO price.
export async function salesReport(period: Period, by: Dimension<"sales">) {
  const key = {
    buyer: (o: Order) => o.buyer.organization.name,
    commodity: (o: Order) => o.batch.commodity,
    grade: (o: Order) => gradeOf(o.batch.grade),
    location: (o: Order) => o.batch.location,
    period: (o: Order) => monthOf(o.confirmedAt),
  }[by];
  return rollup(await confirmedOrders(period), key, (o) => {
    const qty = num(o.orderedQuantity);
    return { tonnes: qty, delivered: num(o.deliveredQuantity), value: qty * num(o.unitPrice) };
  });
}

// FR-67: expected margin on ordered tonnes, realized on delivered tonnes, both
// from the cost frozen on the order (FR-47). Orders with no cost are counted
// in `unknown` rather than treated as zero-cost.
export async function marginReport(period: Period, by: Dimension<"margin">) {
  const key = {
    batch: (o: Order) => o.batch.batchNumber,
    order: (o: Order) => o.reference,
    commodity: (o: Order) => o.batch.commodity,
    period: (o: Order) => monthOf(o.confirmedAt),
  }[by];
  return rollup(await confirmedOrders(period), key, (o) => marginOf(o));
}

export function marginOf(o: { orderedQuantity: unknown; deliveredQuantity: unknown; unitPrice: unknown; unitCostSnapshot: unknown }): Totals {
  const price = num(o.unitPrice);
  const ordered = num(o.orderedQuantity);
  const delivered = num(o.deliveredQuantity);
  if (o.unitCostSnapshot == null) return { revenue: ordered * price, costedRevenue: 0, expected: 0, realizedRevenue: delivered * price, realized: 0, unknown: 1 };
  const perT = price - num(o.unitCostSnapshot);
  return { revenue: ordered * price, costedRevenue: ordered * price, expected: ordered * perT, realizedRevenue: delivered * price, realized: delivered * perT, unknown: 0 };
}

// FR-66: current position, not period-bound. Value is available tonnes at cost.
export async function inventoryReport(by: Dimension<"inventory">) {
  const rows = await prisma.inventoryBatch.findMany({ where: { status: { not: "DEPLETED" } } });
  const key = {
    commodity: (b: (typeof rows)[number]) => b.commodity,
    grade: (b: (typeof rows)[number]) => gradeOf(b.grade),
    batch: (b: (typeof rows)[number]) => b.batchNumber,
    status: (b: (typeof rows)[number]) => b.status,
    location: (b: (typeof rows)[number]) => b.location,
  }[by];
  return rollup(rows, key, (b) => ({
    total: num(b.quantity),
    available: num(b.availableQuantity),
    reserved: num(b.reservedQuantity),
    held: num(b.heldQuantity),
    value: num(b.availableQuantity) * num(b.unitCost),
  }));
}
