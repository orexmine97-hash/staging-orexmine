// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { acceptOffer, createOffer, receiveDelivery, recordQcDecision } from "@/lib/procurement";
import { confirmQuote, createQuote } from "@/lib/sales";
import { deliverShipment, dispatchOrder } from "@/lib/logistics";
import { closeSalesOrder, isOverdue, issueInvoice, recordBuyerPayment, recordMinerPayout } from "@/lib/finance";

// Lib functions don't check roles (the actions do), so one actor drives the whole chain.
const actor = { id: "test-finance-actor", name: "Test Finance", role: "ADMIN" as const };
const tag = `TEST-FIN-${Date.now()}`;
const ids = { orgs: [] as string[], pos: [] as string[], batches: [] as string[] };

// Offer → PO → delivery (48 t verified @ ₦10m) → QC pass: a sellable batch and a payable PO.
async function sourcedBatch() {
  const org = await prisma.organization.create({ data: { name: `${tag} miner`, type: "MINER", status: "ACTIVE" } });
  ids.orgs.push(org.id);
  const miner = await prisma.miner.create({
    data: { organizationId: org.id, reference: `${tag}-${Math.random().toString(36).slice(2, 6)}`, tier: "PREFERRED", monthlyCapTonnes: 100 },
  });
  const po = await createOffer(miner.id, { commodity: "gold", quantity: 50, grade: 83, unitPrice: 10_000_000 }, actor);
  ids.pos.push(po.id);
  await acceptOffer(po.id, actor);
  const { delivery, batch } = await receiveDelivery(
    po.id,
    { declaredQuantity: 50, verifiedQuantity: 48, location: "Test Bay", assay: { testedGrade: 84 } },
    actor,
  );
  ids.batches.push(batch.id);
  await recordQcDecision(delivery.id, "PASS", { reason: "test" }, actor);
  await prisma.inventoryBatch.update({ where: { id: batch.id }, data: { unitPrice: 12_000_000 } });
  return { po, batch };
}

async function deliveredOrder(batchId: string, tonnes: number) {
  const org = await prisma.organization.create({ data: { name: `${tag} buyer`, type: "BUYER", status: "ACTIVE" } });
  ids.orgs.push(org.id);
  const buyer = await prisma.buyer.create({
    data: { organizationId: org.id, reference: `${tag}-${Math.random().toString(36).slice(2, 6)}`, kycStatus: "APPROVED" },
  });
  const quote = await createQuote(buyer.id, batchId, { quantity: tonnes, unitPrice: 12_500_000 }, actor);
  const so = await confirmQuote(quote.id, actor);
  return so;
}

const order = (id: string) => prisma.salesOrder.findUniqueOrThrow({ where: { id } });

// Integration test — needs a real Postgres. Run with `npm run test:integration`.
describe.skipIf(!process.env.RUN_DB_TESTS)("finance: invoice → receipts → close; miner payouts", () => {
  afterAll(async () => {
    const sos = await prisma.salesOrder.findMany({ where: { batchId: { in: ids.batches } }, select: { id: true } });
    const soIds = sos.map((s) => s.id);
    const deliveries = await prisma.delivery.findMany({ where: { purchaseOrderId: { in: ids.pos } }, select: { id: true } });
    const delIds = deliveries.map((d) => d.id);
    const refs = (await prisma.reservation.findMany({ where: { batchId: { in: ids.batches } }, select: { reference: true } })).map((r) => r.reference);
    await prisma.auditEvent.deleteMany({ where: { actorId: "system", recordId: { in: refs } } });
    await prisma.payment.deleteMany({ where: { OR: [{ invoice: { salesOrderId: { in: soIds } } }, { purchaseOrderId: { in: ids.pos } }] } });
    await prisma.invoice.deleteMany({ where: { salesOrderId: { in: soIds } } });
    await prisma.shipment.deleteMany({ where: { salesOrderId: { in: soIds } } });
    await prisma.reservation.deleteMany({ where: { batchId: { in: ids.batches } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: soIds } } });
    await prisma.quote.deleteMany({ where: { batchId: { in: ids.batches } } });
    await prisma.stockMovement.deleteMany({ where: { batchId: { in: ids.batches } } });
    await prisma.sourceVerification.deleteMany({ where: { batchId: { in: ids.batches } } });
    await prisma.inventoryBatch.deleteMany({ where: { id: { in: ids.batches } } });
    await prisma.qcDecision.deleteMany({ where: { deliveryId: { in: delIds } } });
    await prisma.assay.deleteMany({ where: { deliveryId: { in: delIds } } });
    await prisma.delivery.deleteMany({ where: { id: { in: delIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: ids.pos } } });
    await prisma.buyer.deleteMany({ where: { organizationId: { in: ids.orgs } } });
    await prisma.miner.deleteMany({ where: { organizationId: { in: ids.orgs } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 90_000);

  // FRD acceptance #6 (invoiced/paid half) + §6.2 close-out rule.
  it("invoices delivered tonnes only, tracks partial payment, and closes once paid in full", async () => {
    const { batch } = await sourcedBatch();
    const so = await deliveredOrder(batch.id, 10);

    await expect(issueInvoice(so.id, {}, actor)).rejects.toMatchObject({ code: "NOTHING_TO_INVOICE" });

    const ship = await dispatchOrder(so.id, { quantity: 4, carrier: "Test" }, actor);
    await deliverShipment(ship.id, "POD-1", actor);
    const inv = await issueInvoice(so.id, { externalRef: "GL-1" }, actor);
    expect(Number(inv.quantity)).toBe(4);
    expect(Number(inv.amount)).toBe(50_000_000); // 4 t × ₦12.5m frozen price
    await expect(issueInvoice(so.id, {}, actor)).rejects.toMatchObject({ code: "NOTHING_TO_INVOICE" });

    await expect(recordBuyerPayment(inv.id, { amount: 50_000_001 }, actor)).rejects.toMatchObject({ code: "OVERPAYMENT" });
    await recordBuyerPayment(inv.id, { amount: 25_000_000, externalRef: "BANK-1" }, actor);
    let o = await order(so.id);
    expect({ invoiced: Number(o.invoicedQuantity), paid: Number(o.paidQuantity), status: o.status }).toEqual({ invoiced: 4, paid: 2, status: "PARTIAL" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe("PART_PAID");

    await expect(closeSalesOrder(so.id, actor)).rejects.toMatchObject({ code: "INVALID_STATE" });

    await recordBuyerPayment(inv.id, { amount: 25_000_000 }, actor);
    const rest = await dispatchOrder(so.id, { quantity: 6, carrier: "Test" }, actor);
    await deliverShipment(rest.id, "POD-2", actor);
    const inv2 = await issueInvoice(so.id, {}, actor);
    expect((await order(so.id)).status).toBe("INVOICED");
    await recordBuyerPayment(inv2.id, { amount: 75_000_000 }, actor);

    o = await order(so.id);
    expect({ delivered: Number(o.deliveredQuantity), invoiced: Number(o.invoicedQuantity), paid: Number(o.paidQuantity), status: o.status })
      .toEqual({ delivered: 10, invoiced: 10, paid: 10, status: "PAID" });
    await closeSalesOrder(so.id, actor);
    expect((await order(so.id)).status).toBe("CLOSED");
  }, 120_000);

  it("two receipts entered at once can't overpay an invoice", async () => {
    const { batch } = await sourcedBatch();
    const so = await deliveredOrder(batch.id, 2);
    const ship = await dispatchOrder(so.id, { quantity: 2, carrier: "Test" }, actor);
    await deliverShipment(ship.id, "POD", actor);
    const inv = await issueInvoice(so.id, {}, actor); // ₦25m

    const results = await Promise.allSettled([
      recordBuyerPayment(inv.id, { amount: 15_000_000 }, actor),
      recordBuyerPayment(inv.id, { amount: 15_000_000 }, actor),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(Number((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).amountPaid)).toBe(15_000_000);
  }, 120_000);

  it("pays the miner up to verified tonnes × PO price, never more, even when payouts race", async () => {
    const { po } = await sourcedBatch(); // owed 48 t × ₦10m = ₦480m

    const results = await Promise.allSettled([
      recordMinerPayout(po.id, { amount: 300_000_000 }, actor),
      recordMinerPayout(po.id, { amount: 300_000_000 }, actor),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("PAYABLE");

    await expect(recordMinerPayout(po.id, { amount: 180_000_001 }, actor)).rejects.toMatchObject({ code: "OVERPAYMENT" });
    await recordMinerPayout(po.id, { amount: 180_000_000, externalRef: "GL-PYT" }, actor);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).status).toBe("PAID");
    await expect(recordMinerPayout(po.id, { amount: 1 }, actor)).rejects.toMatchObject({ code: "INVALID_STATE" });
  }, 120_000);

  it("flags overdue from the due date, without a sweep", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isOverdue({ status: "ISSUED", dueAt: past })).toBe(true);
    expect(isOverdue({ status: "PART_PAID", dueAt: past })).toBe(true);
    expect(isOverdue({ status: "PAID", dueAt: past })).toBe(false);
    expect(isOverdue({ status: "ISSUED", dueAt: new Date(Date.now() + 86_400_000) })).toBe(false);
  });
});
