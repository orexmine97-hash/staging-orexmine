// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import type { KycStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmQuote, createQuote, setBuyerKyc } from "@/lib/sales";

const actor = { id: "test-sales-actor", name: "Test Trade Desk", role: "SALES" as const };
const tag = `TEST-${Date.now()}`;
const created = { batches: [] as string[], orgs: [] as string[] };

async function makeBuyer(kycStatus: KycStatus) {
  const org = await prisma.organization.create({
    data: { name: `${tag} buyer`, type: "BUYER", status: kycStatus === "APPROVED" ? "ACTIVE" : "PENDING" },
  });
  created.orgs.push(org.id);
  return prisma.buyer.create({
    data: { organizationId: org.id, reference: `${tag}-${Math.random().toString(36).slice(2, 6)}`, kycStatus },
  });
}

async function makeBatch(available: number) {
  const b = await prisma.inventoryBatch.create({
    data: {
      batchNumber: `${tag}-${Math.random().toString(36).slice(2, 6)}`,
      commodity: "gold",
      grade: "80",
      location: "test-harness",
      status: "SELLABLE",
      quantity: available,
      availableQuantity: available,
      unitCost: 10_000_000,
      unitPrice: 12_000_000,
    },
  });
  created.batches.push(b.id);
  return b;
}

const terms = (quantity: number) => ({ quantity, unitPrice: 12_500_000 });

// Integration test — needs a real Postgres; gated like reservations.test.ts.
// Run with `npm run test:integration`.
describe.skipIf(!process.env.RUN_DB_TESTS)("sales: quote → confirmed SO + reservation", () => {
  afterAll(async () => {
    for (const id of created.batches) {
      await prisma.stockMovement.deleteMany({ where: { batchId: id } });
      await prisma.reservation.deleteMany({ where: { batchId: id } });
      await prisma.salesOrder.deleteMany({ where: { batchId: id } });
      await prisma.quote.deleteMany({ where: { batchId: id } });
      await prisma.inventoryBatch.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.orgs) {
      await prisma.quote.deleteMany({ where: { buyer: { organizationId: id } } });
      await prisma.buyer.deleteMany({ where: { organizationId: id } });
      await prisma.organization.delete({ where: { id } }).catch(() => {});
    }
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 60_000);

  it("confirms once: SO + reservation, stock moved, cost frozen; a second confirm is refused", async () => {
    const buyer = await makeBuyer("APPROVED");
    const batch = await makeBatch(10);
    const quote = await createQuote(buyer.id, batch.id, terms(6), actor);
    expect(Number(quote.unitCostSnapshot)).toBe(10_000_000);

    const so = await confirmQuote(quote.id, actor);
    expect(so.status).toBe("RESERVED");
    expect(Number(so.reservedQuantity)).toBe(6);
    expect(Number(so.unitPrice)).toBe(12_500_000);

    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(Number(after.availableQuantity)).toBe(4);
    expect(Number(after.reservedQuantity)).toBe(6);
    expect(await prisma.reservation.count({ where: { salesOrderId: so.id, status: "ACTIVE" } })).toBe(1);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } })).status).toBe("CONFIRMED");

    await expect(confirmQuote(quote.id, actor)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await prisma.salesOrder.count({ where: { quoteId: quote.id } })).toBe(1);
  }, 60_000);

  it("won't oversell across two quotes, and rolls the losing confirmation back whole", async () => {
    const buyer = await makeBuyer("APPROVED");
    const batch = await makeBatch(10);
    const a = await createQuote(buyer.id, batch.id, terms(6), actor);
    const b = await createQuote(buyer.id, batch.id, terms(6), actor);

    await confirmQuote(a.id, actor);
    await expect(confirmQuote(b.id, actor)).rejects.toMatchObject({ code: "INSUFFICIENT_AVAILABLE" });

    // No orphan SO, quote still open, stock untouched by the failed attempt.
    expect(await prisma.salesOrder.count({ where: { quoteId: b.id } })).toBe(0);
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("QUOTED");
    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(Number(after.availableQuantity)).toBe(4);
  }, 60_000);

  it("blocks unapproved buyers, including one suspended after the quote was issued", async () => {
    const pending = await makeBuyer("PENDING");
    const batch = await makeBatch(10);
    await expect(createQuote(pending.id, batch.id, terms(1), actor)).rejects.toMatchObject({ code: "BUYER_NOT_APPROVED" });

    const buyer = await makeBuyer("APPROVED");
    const quote = await createQuote(buyer.id, batch.id, terms(1), actor);
    await setBuyerKyc(buyer.id, "SUSPENDED", "test: sanctions hit", actor);
    await expect(confirmQuote(quote.id, actor)).rejects.toMatchObject({ code: "BUYER_NOT_APPROVED" });
  }, 60_000);
});
