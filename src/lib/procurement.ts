import { Prisma, type MinerTier, type PurchaseOrderStatus, type QcDecisionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/reservations";

export type ProcurementErrorCode =
  | "INVALID_QUANTITY"
  | "MINER_NOT_FOUND"
  | "MINER_NOT_APPROVED"
  | "OVER_CAP"
  | "PO_NOT_FOUND"
  | "INVALID_STATE"
  | "DELIVERY_NOT_FOUND"
  | "NO_HELD_BATCH";

export class ProcurementError extends Error {
  constructor(
    public code: ProcurementErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ProcurementError";
  }
}

// FRD 2.2 / FR-10: only active, approved suppliers may receive offers.
const OFFERABLE_TIERS: MinerTier[] = ["PREFERRED", "CONDITIONAL"];
// FR-13: a PO may take deliveries once accepted (and while still open).
const RECEIVABLE_STATES: PurchaseOrderStatus[] = ["ACCEPTED", "IN_TRANSIT", "RECEIVED"];
const COMMODITY_CODE: Record<string, string> = { gold: "GC", tin: "CS", coltan: "CT", leadzinc: "LZ" };

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 };

type Tx = Prisma.TransactionClient;

function ref(prefix: string): string {
  // ponytail: unique but not human-sequential — a shared ref-sequence generator
  // is a cross-cutting concern; add readable running numbers when the console needs them.
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function batchNumber(commodity: string): string {
  const c = COMMODITY_CODE[commodity] ?? commodity.slice(0, 2).toUpperCase();
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, "0");
  return `OX-${c}-${yymm}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function audit(
  tx: Tx,
  actor: Actor,
  action: string,
  recordType: string,
  recordId: string,
  before: string,
  after: string,
  reason?: string,
) {
  return tx.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      recordType,
      recordId,
      before,
      after,
      reason: reason ?? action,
    },
  });
}

// ── Offer (FR-09/10) ─────────────────────────────────────────
export interface OfferInput {
  commodity: string;
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  grade?: Prisma.Decimal.Value;
  currency?: string;
  deliveryTerms?: string;
  targetLocation?: string;
  validUntil?: Date;
  reason?: string;
}

export async function createOffer(minerId: string, input: OfferInput, actor: Actor) {
  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) throw new ProcurementError("INVALID_QUANTITY", "Offer quantity must be positive.");

  const miner = await prisma.miner.findUnique({
    where: { id: minerId },
    include: { organization: { select: { status: true } } },
  });
  if (!miner) throw new ProcurementError("MINER_NOT_FOUND");
  if (miner.organization.status !== "ACTIVE" || !OFFERABLE_TIERS.includes(miner.tier)) {
    throw new ProcurementError(
      "MINER_NOT_APPROVED",
      `Offers require an active, approved supplier; ${miner.reference} is ${miner.tier} / ${miner.organization.status}.`,
    );
  }
  if (miner.monthlyCapTonnes && qty.gt(miner.monthlyCapTonnes)) {
    throw new ProcurementError(
      "OVER_CAP",
      `Offer ${qty} exceeds ${miner.reference} monthly cap ${miner.monthlyCapTonnes}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        reference: ref("PO"),
        minerId,
        status: "OFFERED",
        commodity: input.commodity,
        declaredQuantity: qty,
        declaredGrade: input.grade != null ? new Prisma.Decimal(input.grade) : null,
        unitPrice: new Prisma.Decimal(input.unitPrice),
        currency: input.currency ?? "NGN",
        deliveryTerms: input.deliveryTerms,
        targetLocation: input.targetLocation,
        validUntil: input.validUntil,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "Purchase offer issued", "PurchaseOrder", po.reference, "—", `Offered · ${qty} ${input.commodity}`, input.reason);
    return po;
  });
}

// ── Acceptance (FR-11) ───────────────────────────────────────
export async function acceptOffer(purchaseOrderId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po) throw new ProcurementError("PO_NOT_FOUND");
    if (po.status !== "OFFERED") {
      throw new ProcurementError("INVALID_STATE", `PO is ${po.status}; only an OFFERED order can be accepted.`);
    }
    const updated = await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "ACCEPTED" } });
    await audit(tx, actor, "Purchase order accepted", "PurchaseOrder", po.reference, "Offered", "Accepted");
    return updated;
  });
}

// ── Receiving + assay (FR-13/16/19/25) ───────────────────────
// Creates the batch NON-sellable (QC_HOLD, held pending QC); a QC pass is the
// only thing that makes it sellable (FR-18).
export interface ReceiveInput {
  declaredQuantity: Prisma.Decimal.Value;
  verifiedQuantity: Prisma.Decimal.Value;
  location: string;
  unitCost?: Prisma.Decimal.Value;
  assay: {
    testedGrade: Prisma.Decimal.Value;
    laboratory?: string;
    sampleReference?: string;
    purity?: Prisma.Decimal.Value;
    contaminants?: string;
    assayDate?: Date;
  };
  reason?: string;
}

export async function receiveDelivery(purchaseOrderId: string, input: ReceiveInput, actor: Actor) {
  const declared = new Prisma.Decimal(input.declaredQuantity);
  const verified = new Prisma.Decimal(input.verifiedQuantity);
  if (verified.lte(0)) throw new ProcurementError("INVALID_QUANTITY", "Verified quantity must be positive.");

  return prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po) throw new ProcurementError("PO_NOT_FOUND");
    if (!RECEIVABLE_STATES.includes(po.status)) {
      throw new ProcurementError("INVALID_STATE", `PO is ${po.status}; accept it before recording a delivery.`);
    }

    const delivery = await tx.delivery.create({
      data: {
        reference: ref("DEL"),
        purchaseOrderId,
        status: "RECEIVED",
        declaredQuantity: declared,
        verifiedQuantity: verified,
        declaredGrade: po.declaredGrade,
        custodyLocation: input.location,
        receivedAt: new Date(),
      },
    });
    const assay = await tx.assay.create({
      data: {
        reference: ref("ASY"),
        deliveryId: delivery.id,
        laboratory: input.assay.laboratory,
        sampleReference: input.assay.sampleReference,
        testedGrade: new Prisma.Decimal(input.assay.testedGrade),
        purity: input.assay.purity != null ? new Prisma.Decimal(input.assay.purity) : null,
        contaminants: input.assay.contaminants,
        assayDate: input.assay.assayDate ?? new Date(),
      },
    });
    const batch = await tx.inventoryBatch.create({
      data: {
        batchNumber: batchNumber(po.commodity),
        commodity: po.commodity,
        grade: new Prisma.Decimal(input.assay.testedGrade),
        location: input.location,
        status: "QC_HOLD",
        quantity: verified,
        availableQuantity: 0,
        heldQuantity: verified, // whole receipt is quarantined pending QC
        unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : po.unitPrice,
        currency: po.currency,
        sourceDeliveryId: delivery.id,
      },
    });
    await tx.stockMovement.create({
      data: {
        batchId: batch.id,
        type: "RECEIVE",
        quantity: verified,
        reason: `Received via ${delivery.reference}`,
        refType: "Delivery",
        refId: delivery.reference,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: "RECEIVED" } });

    const gap = verified.lt(declared)
      ? ` · short ${declared.sub(verified)}`
      : verified.gt(declared)
        ? ` · excess ${verified.sub(declared)}`
        : "";
    await audit(tx, actor, "Delivery received", "Delivery", delivery.reference, `declared ${declared}`, `verified ${verified}${gap} · ${batch.batchNumber} (QC hold)`, input.reason);
    return { delivery, assay, batch };
  }, TX_OPTS);
}

// ── QC decision — the gate to sellable (FR-17/18/21) ─────────
export async function recordQcDecision(
  deliveryId: string,
  decision: QcDecisionType,
  opts: { reason: string },
  actor: Actor,
) {
  return prisma.$transaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: deliveryId },
      include: { batches: true, assays: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!delivery) throw new ProcurementError("DELIVERY_NOT_FOUND");
    const batch = delivery.batches[0];
    if (!batch) throw new ProcurementError("NO_HELD_BATCH");
    if (batch.status !== "QC_HOLD") {
      throw new ProcurementError("INVALID_STATE", `Batch ${batch.batchNumber} is ${batch.status}; QC is already decided.`);
    }

    const tested = delivery.assays[0]?.testedGrade ?? null;
    const variance = tested != null && delivery.declaredGrade != null ? tested.sub(delivery.declaredGrade) : null;

    let poStatus: PurchaseOrderStatus;
    let after: string;
    if (decision === "PASS") {
      poStatus = "QC_PASSED";
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { status: "SELLABLE", availableQuantity: batch.quantity, heldQuantity: 0 },
      });
      await tx.sourceVerification.create({
        data: {
          batchId: batch.id,
          method: "Miner title + delivery cross-check",
          reference: `${delivery.reference}/SRC`,
          verifiedById: actor.id,
          verifiedByName: actor.name,
        },
      });
      after = `SELLABLE · available ${batch.quantity}`;
    } else if (decision === "FAIL") {
      poStatus = "QC_FAILED";
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { status: "QC_FAIL", rejectedQuantity: batch.quantity, heldQuantity: 0 },
      });
      after = `QC_FAIL · rejected ${batch.quantity}`;
    } else {
      // HOLD or RETEST — stays quarantined, not sellable.
      poStatus = "QC_HOLD";
      after = decision === "RETEST" ? "QC hold · retest ordered" : "QC hold";
    }

    const qc = await tx.qcDecision.create({
      data: {
        deliveryId,
        decision,
        gradeVariance: variance,
        reason: opts.reason,
        decidedById: actor.id,
        decidedByName: actor.name,
      },
    });
    // ponytail: single-delivery PO roll-up. Multi-delivery POs need status
    // derived from all their deliveries — add when pooling/partial QC lands.
    await tx.purchaseOrder.update({ where: { id: delivery.purchaseOrderId }, data: { status: poStatus } });
    if (decision === "PASS") {
      await tx.delivery.update({ where: { id: deliveryId }, data: { status: "VERIFIED" } });
    }
    await audit(tx, actor, `QC decision — ${decision.toLowerCase()}`, "QcDecision", `${delivery.reference} / ${batch.batchNumber}`, `${batch.status} · held ${batch.quantity}`, after, opts.reason);

    return { qcDecision: qc, batchId: batch.id, batchStatus: decision === "PASS" ? "SELLABLE" : decision === "FAIL" ? "QC_FAIL" : "QC_HOLD" };
  }, TX_OPTS);
}
