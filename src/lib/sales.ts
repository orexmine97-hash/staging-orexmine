import { Prisma, type KycStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, ref } from "@/lib/procurement";
import { type Actor, RESERVE_TX_OPTS, reserveInTx } from "@/lib/reservations";

export type SalesErrorCode =
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "BUYER_NOT_FOUND"
  | "BUYER_NOT_APPROVED"
  | "NOT_A_BUYER"
  | "BATCH_NOT_FOUND"
  | "NOT_SELLABLE"
  | "INSUFFICIENT_AVAILABLE"
  | "QUOTE_NOT_FOUND"
  | "QUOTE_EXPIRED"
  | "INVALID_STATE"
  | "REASON_REQUIRED";

export class SalesError extends Error {
  constructor(
    public code: SalesErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SalesError";
  }
}

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 };
// Seeded quotes run three days; staff can override per quote.
export const DEFAULT_QUOTE_VALID_DAYS = 3;
const KYC_DECISIONS: KycStatus[] = ["APPROVED", "SUSPENDED", "REJECTED"];

const positive = (v: Prisma.Decimal.Value, code: "INVALID_QUANTITY" | "INVALID_PRICE", what: string) => {
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(v);
  } catch {
    throw new SalesError(code, `${what} must be a number.`);
  }
  if (d.lte(0)) throw new SalesError(code, `${what} must be positive.`);
  return d;
};

// FR-32 / §9: only an approved buyer may hold a live quote or confirm an order.
function assertApproved(buyer: { reference: string; kycStatus: KycStatus }) {
  if (buyer.kycStatus !== "APPROVED") {
    throw new SalesError("BUYER_NOT_APPROVED", `${buyer.reference} KYC is ${buyer.kycStatus}; only approved buyers can trade.`);
  }
}

// Soft pre-check for a friendlier error; the reservation at confirmation is the
// real double-sell guard.
async function sellableBatch(tx: Prisma.TransactionClient, batchId: string, qty: Prisma.Decimal) {
  const batch = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new SalesError("BATCH_NOT_FOUND");
  if (batch.status !== "SELLABLE") throw new SalesError("NOT_SELLABLE", `${batch.batchNumber} is ${batch.status}, not sellable.`);
  if (qty.gt(batch.availableQuantity)) {
    throw new SalesError("INSUFFICIENT_AVAILABLE", `Only ${batch.availableQuantity} t available on ${batch.batchNumber}.`);
  }
  return batch;
}

const validUntil = (days?: number) =>
  new Date(Date.now() + (days && days > 0 ? days : DEFAULT_QUOTE_VALID_DAYS) * 86_400_000);

// ── Buyer KYC (FR-31) ────────────────────────────────────────
export async function setBuyerKyc(buyerId: string, status: KycStatus, reason: string, actor: Actor) {
  if (!KYC_DECISIONS.includes(status)) throw new SalesError("INVALID_STATE", `Unsupported KYC decision ${status}.`);
  if (!reason.trim()) throw new SalesError("REASON_REQUIRED", "A reason is required for every KYC decision.");

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new SalesError("BUYER_NOT_FOUND");
    if (buyer.kycStatus === status) throw new SalesError("INVALID_STATE", `${buyer.reference} is already ${status}.`);

    const updated = await tx.buyer.update({
      where: { id: buyerId },
      data: {
        kycStatus: status,
        ...(status === "APPROVED" && { kycApprovedById: actor.id, kycApprovedAt: new Date() }),
        organization: { update: { status: status === "APPROVED" ? "ACTIVE" : status === "SUSPENDED" ? "SUSPENDED" : "REJECTED" } },
      },
    });
    await audit(tx, actor, `Buyer KYC ${status.toLowerCase()}`, "Buyer", buyer.reference, buyer.kycStatus, status, reason);
    return updated;
  }, TX_OPTS);
}

// ── Buyer quote request from the showcase (FR-86) ────────────
// Lands as a DRAFT at the batch's indicative ask; the trade desk prices it.
export async function requestQuote(authId: string, batchId: string, quantity: Prisma.Decimal.Value, actor: Actor) {
  const qty = positive(quantity, "INVALID_QUANTITY", "Quantity");
  const user = await prisma.user.findUnique({
    where: { authId },
    include: { organization: { include: { buyer: true } } },
  });
  const buyer = user?.organization.buyer;
  if (!buyer) throw new SalesError("NOT_A_BUYER", "Only buyer accounts can request quotes.");
  assertApproved(buyer);

  return prisma.$transaction(async (tx) => {
    const batch = await sellableBatch(tx, batchId, qty);
    const quote = await tx.quote.create({
      data: {
        reference: ref("QTE"),
        buyerId: buyer.id,
        batchId,
        status: "DRAFT",
        quantity: qty,
        unitPrice: batch.unitPrice ?? 0,
        unitCostSnapshot: batch.unitCost,
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "Quote requested", "Quote", quote.reference, "—", `Draft · ${qty} t of ${batch.batchNumber}`);
    return quote;
  }, TX_OPTS);
}

// ── Trade desk quote (FR-36/37) ──────────────────────────────
export interface QuoteTerms {
  quantity: Prisma.Decimal.Value;
  unitPrice: Prisma.Decimal.Value;
  validDays?: number;
  deliveryTerms?: string;
  destination?: string;
}

// New quote straight from the trade desk.
export async function createQuote(buyerId: string, batchId: string, terms: QuoteTerms, actor: Actor) {
  const qty = positive(terms.quantity, "INVALID_QUANTITY", "Quantity");
  const price = positive(terms.unitPrice, "INVALID_PRICE", "Unit price");

  return prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new SalesError("BUYER_NOT_FOUND");
    assertApproved(buyer);
    const batch = await sellableBatch(tx, batchId, qty);
    const quote = await tx.quote.create({
      data: {
        reference: ref("QTE"),
        buyerId,
        batchId,
        status: "QUOTED",
        quantity: qty,
        unitPrice: price,
        // Cost frozen now so later cost changes don't rewrite the margin (FR-47).
        unitCostSnapshot: batch.unitCost,
        deliveryTerms: terms.deliveryTerms || null,
        destination: terms.destination || null,
        validUntil: validUntil(terms.validDays),
        createdById: actor.id,
      },
    });
    await audit(tx, actor, "Quote issued", "Quote", quote.reference, "—", `Quoted · ${qty} t @ ${price}`);
    return quote;
  }, TX_OPTS);
}

// Price a buyer's DRAFT request and send it (DRAFT → QUOTED).
export async function issueQuote(quoteId: string, terms: QuoteTerms, actor: Actor) {
  const qty = positive(terms.quantity, "INVALID_QUANTITY", "Quantity");
  const price = positive(terms.unitPrice, "INVALID_PRICE", "Unit price");

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { buyer: true } });
    if (!quote) throw new SalesError("QUOTE_NOT_FOUND");
    if (quote.status !== "DRAFT") throw new SalesError("INVALID_STATE", `${quote.reference} is ${quote.status}; only a draft can be issued.`);
    assertApproved(quote.buyer);
    const batch = await sellableBatch(tx, quote.batchId, qty);
    const updated = await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: "QUOTED",
        quantity: qty,
        unitPrice: price,
        unitCostSnapshot: batch.unitCost,
        deliveryTerms: terms.deliveryTerms || null,
        destination: terms.destination || null,
        validUntil: validUntil(terms.validDays),
      },
    });
    await audit(tx, actor, "Quote issued", "Quote", quote.reference, "Draft", `Quoted · ${qty} t @ ${price}`);
    return updated;
  }, TX_OPTS);
}

export async function declineQuote(quoteId: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw new SalesError("REASON_REQUIRED", "A reason is required to decline a quote.");
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new SalesError("QUOTE_NOT_FOUND");
    const moved = await tx.quote.updateMany({
      where: { id: quoteId, status: { in: ["DRAFT", "QUOTED"] } },
      data: { status: "DECLINED" },
    });
    if (moved.count === 0) throw new SalesError("INVALID_STATE", `${quote.reference} is ${quote.status}; it can no longer be declined.`);
    await audit(tx, actor, "Quote declined", "Quote", quote.reference, quote.status, "Declined", reason);
  }, TX_OPTS);
}

// ── Confirmation → sales order + reservation (FR-38/39) ──────
/**
 * Confirms a QUOTED quote: creates the SO and reserves its stock in ONE
 * transaction, so there's never an order without stock or stock held with no
 * order. The quote flips QUOTED → CONFIRMED with a conditional update, so two
 * racing confirmations of the same quote can't both produce an SO; the
 * reservation's conditional UPDATE stops two quotes overselling one batch.
 */
export async function confirmQuote(quoteId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({ where: { id: quoteId }, include: { buyer: true, batch: true } });
    if (!quote) throw new SalesError("QUOTE_NOT_FOUND");
    if (quote.status !== "QUOTED") throw new SalesError("INVALID_STATE", `${quote.reference} is ${quote.status}; only a quoted offer can be confirmed.`);
    if (quote.validUntil && quote.validUntil < new Date()) {
      throw new SalesError("QUOTE_EXPIRED", `${quote.reference} expired on ${quote.validUntil.toISOString().slice(0, 10)}. Issue a new quote.`);
    }
    // Re-checked at confirmation: KYC can change while a quote is open.
    assertApproved(quote.buyer);

    const flipped = await tx.quote.updateMany({ where: { id: quoteId, status: "QUOTED" }, data: { status: "CONFIRMED" } });
    if (flipped.count === 0) throw new SalesError("INVALID_STATE", `${quote.reference} was confirmed or changed by someone else.`);

    const so = await tx.salesOrder.create({
      data: {
        reference: ref("SO"),
        buyerId: quote.buyerId,
        batchId: quote.batchId,
        quoteId: quote.id,
        status: "RESERVED",
        orderedQuantity: quote.quantity,
        reservedQuantity: quote.quantity,
        unitPrice: quote.unitPrice, // frozen (FR-47)
        unitCostSnapshot: quote.unitCostSnapshot,
        currency: quote.currency,
        deliveryTerms: quote.deliveryTerms,
        destination: quote.destination,
        confirmedAt: new Date(),
        createdById: actor.id,
      },
    });

    await reserveInTx(
      tx,
      { batchId: quote.batchId, quantity: quote.quantity, salesOrderId: so.id, reason: `Reserved for ${so.reference}` },
      actor,
    );
    await audit(tx, actor, "Sales order confirmed", "SalesOrder", so.reference, `Quote ${quote.reference}`, `Reserved · ${quote.quantity} t of ${quote.batch.batchNumber}`);
    return so;
  }, RESERVE_TX_OPTS);
}

// FR-37 expected gross margin from the frozen cost snapshot.
export function expectedMargin(quantity: Prisma.Decimal.Value, unitPrice: Prisma.Decimal.Value, unitCost: Prisma.Decimal.Value | null) {
  if (unitCost == null) return null;
  const price = Number(unitPrice);
  const perT = price - Number(unitCost);
  return { total: perT * Number(quantity), pct: price > 0 ? (perT / price) * 100 : 0 };
}
