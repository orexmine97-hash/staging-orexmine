// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import type { MinerTier, OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createOffer, acceptOffer, receiveDelivery, recordQcDecision } from "@/lib/procurement";
import { reserveBatch } from "@/lib/reservations";

const actor = { id: "test-proc-actor", name: "Test Procurement", role: "PROCUREMENT" as const };

const orgIds: string[] = [];
const minerIds: string[] = [];
const poIds: string[] = [];
const deliveryIds: string[] = [];
const batchIds: string[] = [];

async function makeMiner(tier: MinerTier, status: OrganizationStatus = "ACTIVE", cap = 100) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const org = await prisma.organization.create({ data: { name: `T Miner ${suffix}`, type: "MINER", status } });
  orgIds.push(org.id);
  const miner = await prisma.miner.create({
    data: { organizationId: org.id, reference: `TMIN-${suffix}`, tier, monthlyCapTonnes: cap },
  });
  minerIds.push(miner.id);
  return miner;
}

async function runToReceived(tier: MinerTier = "PREFERRED") {
  const miner = await makeMiner(tier);
  const po = await createOffer(miner.id, { commodity: "gold", quantity: 50, grade: 83, unitPrice: 10_000_000 }, actor);
  poIds.push(po.id);
  await acceptOffer(po.id, actor);
  const { delivery, batch } = await receiveDelivery(
    po.id,
    { declaredQuantity: 50, verifiedQuantity: 48, location: "Test Bay", assay: { testedGrade: 84 } },
    actor,
  );
  deliveryIds.push(delivery.id);
  batchIds.push(batch.id);
  return { miner, po, delivery, batch };
}

describe.skipIf(!process.env.RUN_DB_TESTS)("procurement — offer -> PO -> QC -> sellable", () => {
  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.stockMovement.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.sourceVerification.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.inventoryBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.qcDecision.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
    await prisma.assay.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
    await prisma.delivery.deleteMany({ where: { id: { in: deliveryIds } } });
    await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
    await prisma.miner.deleteMany({ where: { id: { in: minerIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 30_000);

  it("carries an offer through to a sellable, traceable, reservable batch", async () => {
    const { miner, delivery, batch } = await runToReceived();

    // Received but NOT yet sellable — the QC gate holds it back (FR-18).
    let held = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(held.status).toBe("QC_HOLD");
    expect(Number(held.availableQuantity)).toBe(0);
    expect(Number(held.heldQuantity)).toBe(48);
    await expect(reserveBatch({ batchId: batch.id, quantity: 1 }, actor)).rejects.toMatchObject({ code: "NOT_SELLABLE" });

    // QC pass makes it sellable.
    const { batchStatus } = await recordQcDecision(delivery.id, "PASS", { reason: "Tested 84% vs 83% declared" }, actor);
    expect(batchStatus).toBe("SELLABLE");

    const sellable = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(sellable.status).toBe("SELLABLE");
    expect(Number(sellable.availableQuantity)).toBe(48);
    expect(Number(sellable.heldQuantity)).toBe(0);

    // Full traceability chain (FR-24): batch -> delivery -> PO -> miner, + assay/QC/source.
    const trace = await prisma.inventoryBatch.findUniqueOrThrow({
      where: { id: batch.id },
      include: {
        sourceDelivery: { include: { purchaseOrder: { include: { miner: true } }, assays: true, qcDecisions: true } },
        sourceVerification: true,
      },
    });
    expect(trace.sourceDelivery?.purchaseOrder.miner.id).toBe(miner.id);
    expect(trace.sourceDelivery?.assays.length).toBeGreaterThanOrEqual(1);
    expect(trace.sourceDelivery?.qcDecisions).toHaveLength(1);
    expect(trace.sourceVerification).not.toBeNull();

    // The two halves connect: the sellable batch is now reservable.
    const reservation = await reserveBatch({ batchId: batch.id, quantity: 10 }, actor);
    expect(reservation.id).toBeTruthy();
    const afterResv = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(Number(afterResv.availableQuantity)).toBe(38);
    expect(Number(afterResv.reservedQuantity)).toBe(10);
  }, 30_000);

  it("refuses an offer to a non-approved miner", async () => {
    const m = await makeMiner("PROBATIONARY");
    await expect(
      createOffer(m.id, { commodity: "gold", quantity: 10, unitPrice: 1_000_000 }, actor),
    ).rejects.toMatchObject({ code: "MINER_NOT_APPROVED" });
  });

  it("refuses an offer to a suspended supplier's account", async () => {
    const m = await makeMiner("PREFERRED", "SUSPENDED");
    await expect(
      createOffer(m.id, { commodity: "gold", quantity: 10, unitPrice: 1_000_000 }, actor),
    ).rejects.toMatchObject({ code: "MINER_NOT_APPROVED" });
  });

  it("refuses an offer above the monthly cap", async () => {
    const m = await makeMiner("PREFERRED", "ACTIVE", 30);
    await expect(
      createOffer(m.id, { commodity: "gold", quantity: 50, unitPrice: 1_000_000 }, actor),
    ).rejects.toMatchObject({ code: "OVER_CAP" });
  });

  it("QC fail leaves the batch unsellable and unreservable", async () => {
    const { delivery, batch } = await runToReceived();
    const { batchStatus } = await recordQcDecision(delivery.id, "FAIL", { reason: "Grade far below declared" }, actor);
    expect(batchStatus).toBe("QC_FAIL");

    const failed = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: batch.id } });
    expect(failed.status).toBe("QC_FAIL");
    expect(Number(failed.rejectedQuantity)).toBe(48);
    expect(Number(failed.availableQuantity)).toBe(0);
    await expect(reserveBatch({ batchId: batch.id, quantity: 1 }, actor)).rejects.toMatchObject({ code: "NOT_SELLABLE" });
  }, 30_000);
});
