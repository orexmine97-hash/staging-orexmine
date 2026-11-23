// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmQuote, createQuote, reReserveOrder } from "@/lib/sales";
import { deliverShipment, dispatchOrder, returnShipment } from "@/lib/logistics";

const actor = { id: "test-logistics-actor", name: "Test Warehouse", role: "WAREHOUSE_LOGISTICS" as const };
const tag = `TEST-LOG-${Date.now()}`;
const created = { batches: [] as string[], orgs: [] as string[] };

async function reservedOrder(ordered: number, stock = 100) {
  const org = await prisma.organization.create({ data: { name: `${tag} buyer`, type: "BUYER", status: "ACTIVE" } });
  created.orgs.push(org.id);
  const buyer = await prisma.buyer.create({
    data: { organizationId: org.id, reference: `${tag}-${Math.random().toString(36).slice(2, 6)}`, kycStatus: "APPROVED" },
  });
  const batch = await prisma.inventoryBatch.create({
    data: {
      batchNumber: `${tag}-${Math.random().toString(36).slice(2, 6)}`,
      commodity: "gold",
      grade: "80",
      location: "test-harness",
      status: "SELLABLE",
      quantity: stock,
      availableQuantity: stock,
      unitCost: 10_000_000,
      unitPrice: 12_000_000,
    },
  });
  created.batches.push(batch.id);
  const quote = await createQuote(buyer.id, batch.id, { quantity: ordered, unitPrice: 12_500_000 }, actor);
  return { batch, so: await confirmQuote(quote.id, actor) };
}

const buckets = async (batchId: string, soId: string) => {
  const b = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batchId } });
  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: soId } });
  const n = (v: unknown) => Number(v);
  return {
    batch: { available: n(b.availableQuantity), reserved: n(b.reservedQuantity), dispatched: n(b.dispatchedQuantity), delivered: n(b.deliveredQuantity), held: n(b.heldQuantity) },
    so: { status: so.status, reserved: n(so.reservedQuantity), dispatched: n(so.dispatchedQuantity), delivered: n(so.deliveredQuantity) },
  };
};

// Integration test — needs a real Postgres. Run with `npm run test:integration`.
describe.skipIf(!process.env.RUN_DB_TESTS)("logistics: dispatch → deliver / return", () => {
  afterAll(async () => {
    for (const id of created.batches) {
      const refs = (await prisma.reservation.findMany({ where: { batchId: id }, select: { reference: true } })).map((r) => r.reference);
      await prisma.auditEvent.deleteMany({ where: { actorId: "system", recordId: { in: refs } } });
      await prisma.stockMovement.deleteMany({ where: { batchId: id } });
      await prisma.reservation.deleteMany({ where: { batchId: id } });
      await prisma.shipment.deleteMany({ where: { salesOrder: { batchId: id } } });
      await prisma.salesOrder.deleteMany({ where: { batchId: id } });
      await prisma.quote.deleteMany({ where: { batchId: id } });
      await prisma.inventoryBatch.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.orgs) {
      await prisma.buyer.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } }).catch(() => {});
    }
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 60_000);

  // FRD acceptance #6.
  it("ships and delivers a partial order with every bucket kept distinct", async () => {
    const { batch, so } = await reservedOrder(10);

    await expect(dispatchOrder(so.id, { quantity: 11, carrier: "Test" }, actor)).rejects.toMatchObject({ code: "OVER_DISPATCH" });

    const first = await dispatchOrder(so.id, { quantity: 4, carrier: "Test" }, actor);
    expect(first.status).toBe("IN_TRANSIT");
    expect(await buckets(batch.id, so.id)).toEqual({
      batch: { available: 90, reserved: 6, dispatched: 4, delivered: 0, held: 0 },
      so: { status: "PARTIAL", reserved: 6, dispatched: 4, delivered: 0 },
    });

    await expect(deliverShipment(first.id, " ", actor)).rejects.toMatchObject({ code: "POD_REQUIRED" });
    await deliverShipment(first.id, "WB-001 signed", actor);
    await expect(deliverShipment(first.id, "WB-001 again", actor)).rejects.toMatchObject({ code: "INVALID_STATE" });

    const second = await dispatchOrder(so.id, { quantity: 6, carrier: "Test" }, actor);
    await deliverShipment(second.id, "WB-002 signed", actor);
    expect(await buckets(batch.id, so.id)).toEqual({
      batch: { available: 90, reserved: 0, dispatched: 0, delivered: 10, held: 0 },
      so: { status: "DELIVERED", reserved: 0, dispatched: 10, delivered: 10 },
    });
    expect((await prisma.reservation.findFirstOrThrow({ where: { salesOrderId: so.id } })).status).toBe("CONSUMED");
    expect(await prisma.stockMovement.count({ where: { batchId: batch.id, type: { in: ["DISPATCH", "DELIVER"] } } })).toBe(4);
  }, 90_000);

  it("two racing dispatches can't ship more than is reserved", async () => {
    const { batch, so } = await reservedOrder(10);
    const results = await Promise.allSettled([
      dispatchOrder(so.id, { quantity: 7, carrier: "A" }, actor),
      dispatchOrder(so.id, { quantity: 7, carrier: "B" }, actor),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const { batch: b, so: o } = await buckets(batch.id, so.id);
    expect(b.reserved + b.dispatched).toBe(10);
    expect(o.dispatched).toBe(7);
    expect(await prisma.shipment.count({ where: { salesOrderId: so.id } })).toBe(1);
  }, 90_000);

  it("a return holds the tonnes for inspection and reopens the order; the remainder can be re-reserved", async () => {
    const { batch, so } = await reservedOrder(10);
    const ship = await dispatchOrder(so.id, { quantity: 10, carrier: "Test" }, actor);
    expect((await buckets(batch.id, so.id)).so.status).toBe("DISPATCHED");

    await expect(returnShipment(ship.id, "", actor)).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await returnShipment(ship.id, "test: buyer refused at gate", actor);
    expect(await buckets(batch.id, so.id)).toEqual({
      batch: { available: 90, reserved: 0, dispatched: 0, delivered: 0, held: 10 },
      so: { status: "CONFIRMED", reserved: 0, dispatched: 0, delivered: 0 },
    });

    await reReserveOrder(so.id, actor);
    expect((await buckets(batch.id, so.id)).so).toMatchObject({ status: "RESERVED", reserved: 10 });
  }, 90_000);

  it("a partly shipped order whose remaining hold lapsed can re-reserve just the remainder", async () => {
    const { batch, so } = await reservedOrder(10);
    await dispatchOrder(so.id, { quantity: 4, carrier: "Test" }, actor);
    await prisma.reservation.updateMany({ where: { salesOrderId: so.id, status: "ACTIVE" }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    await reReserveOrder(so.id, actor); // its own sweep frees the lapsed 6 t, then re-holds them
    expect(await buckets(batch.id, so.id)).toEqual({
      batch: { available: 90, reserved: 6, dispatched: 4, delivered: 0, held: 0 },
      so: { status: "PARTIAL", reserved: 6, dispatched: 4, delivered: 0 },
    });
  }, 90_000);
});
