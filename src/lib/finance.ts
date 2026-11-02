import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, ref } from "@/lib/procurement";
import type { Actor } from "@/lib/reservations";
import { fulfilmentStatus } from "@/lib/sales";

export type FinanceErrorCode =
  | "INVALID_AMOUNT"
  | "ORDER_NOT_FOUND"
  | "INVOICE_NOT_FOUND"
  | "PO_NOT_FOUND"
  | "NOTHING_TO_INVOICE"
  | "OVERPAYMENT"
  | "INVALID_STATE";

export class FinanceError extends Error {
  constructor(
    public code: FinanceErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "FinanceError";
  }
}

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 };
export const DEFAULT_PAYMENT_TERMS_DAYS = 30;
const ZERO = new Prisma.Decimal(0);

function amountOf(v: Prisma.Decimal.Value) {
  let d: Prisma.Decimal;
  try {
    d = new Prisma.Decimal(v);
  } catch {
    throw new FinanceError("INVALID_AMOUNT", "Amount must be a number.");
  }
  if (d.lte(0)) throw new FinanceError("INVALID_AMOUNT", "Amount must be positive.");
  return d.toDecimalPlaces(2);
}

// Overdue is derived, not stored: no sweep to forget, never stale (FR-51).
export function isOverdue(inv: { status: string; dueAt: Date | null }, now = new Date()) {
  return (inv.status === "ISSUED" || inv.status === "PART_PAID") && inv.dueAt != null && inv.dueAt < now;
}

// ── Buyer invoicing (FR-50) ──────────────────────────────────
export interface InvoiceInput {
  dueDays?: number;
  terms?: string;
  externalRef?: string;
}

/**
 * Bill everything delivered but not yet invoiced, at the SO's frozen price.
 * ponytail: one billing rule (invoice on delivery). Deposits / pro-forma on
 * confirmation need a per-buyer rule (FR-34) — add with credit terms.
 */
export async function issueInvoice(soId: string, input: InvoiceInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new FinanceError("ORDER_NOT_FOUND");
    if (so.status === "CANCELLED" || so.status === "CLOSED") {
      throw new FinanceError("INVALID_STATE", `${so.reference} is ${so.status}.`);
    }
    const qty = so.deliveredQuantity.sub(so.invoicedQuantity);
    if (qty.lte(0)) throw new FinanceError("NOTHING_TO_INVOICE", `${so.reference} has no delivered tonnes left to invoice.`);

    // Guarded on the invoiced bucket so two racing invoices can't bill the same tonnes.
    const moved = await tx.salesOrder.updateMany({
      where: { id: soId, invoicedQuantity: so.invoicedQuantity },
      data: { invoicedQuantity: { increment: qty } },
    });
    if (moved.count === 0) throw new FinanceError("INVALID_STATE", `${so.reference} was invoiced by someone else; reload.`);
    const after = await tx.salesOrder.findUniqueOrThrow({ where: { id: soId } });
    await tx.salesOrder.update({ where: { id: soId }, data: { status: fulfilmentStatus(after) } });

    const days = input.dueDays && input.dueDays > 0 ? input.dueDays : DEFAULT_PAYMENT_TERMS_DAYS;
    const invoice = await tx.invoice.create({
      data: {
        reference: ref("INV"),
        salesOrderId: soId,
        status: "ISSUED",
        quantity: qty,
        amount: qty.mul(so.unitPrice).toDecimalPlaces(2),
        currency: so.currency,
        terms: input.terms || so.deliveryTerms,
        dueAt: new Date(Date.now() + days * 86_400_000),
        externalRef: input.externalRef || null,
      },
    });
    await audit(tx, actor, "Invoice issued", "Invoice", invoice.reference, `${so.reference} invoiced ${so.invoicedQuantity} t`, `${qty} t · ${invoice.amount} ${invoice.currency} · due ${invoice.dueAt?.toISOString().slice(0, 10)}`);
    return invoice;
  }, TX_OPTS);
}

// ── Buyer receipts (FR-51/52) ────────────────────────────────
export interface PaymentInput {
  amount: Prisma.Decimal.Value;
  method?: string;
  externalRef?: string;
  paidAt?: Date;
}

/**
 * Record money received against an invoice. The conditional increment refuses
 * overpayment atomically, so two receipts entered at once can't exceed the
 * invoice. The SO's paid bucket is recomputed from its invoices.
 * ponytail: no credits/refunds yet — an overpayment is refused, not banked.
 */
export async function recordBuyerPayment(invoiceId: string, input: PaymentInput, actor: Actor) {
  const amount = amountOf(input.amount);
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new FinanceError("INVOICE_NOT_FOUND");
    if (inv.status !== "ISSUED" && inv.status !== "PART_PAID") {
      throw new FinanceError("INVALID_STATE", `${inv.reference} is ${inv.status}; it can't take payments.`);
    }
    const moved = await tx.invoice.updateMany({
      where: { id: invoiceId, status: { in: ["ISSUED", "PART_PAID"] }, amountPaid: { lte: inv.amount.sub(amount) } },
      data: { amountPaid: { increment: amount } },
    });
    if (moved.count === 0) {
      const now = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      throw new FinanceError("OVERPAYMENT", `${inv.reference} has ${now.amount.sub(now.amountPaid)} outstanding; ${amount} would overpay it.`);
    }
    const after = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const status = after.amountPaid.gte(after.amount) ? "PAID" : "PART_PAID";
    await tx.invoice.update({ where: { id: invoiceId }, data: { status } });

    const payment = await tx.payment.create({
      data: {
        reference: ref("RCT"),
        type: "BUYER_RECEIPT",
        amount,
        currency: inv.currency,
        method: input.method || null,
        externalRef: input.externalRef || null,
        invoiceId,
        recordedById: actor.id,
        paidAt: input.paidAt ?? new Date(),
      },
    });

    // Paid tonnes = each invoice's tonnes × the share of it that's been paid.
    const invoices = await tx.invoice.findMany({ where: { salesOrderId: inv.salesOrderId, status: { not: "CANCELLED" } } });
    const paidQty = invoices.reduce(
      (sum, i) => (i.quantity && i.amount.gt(0) ? sum.add(i.quantity.mul(i.amountPaid).div(i.amount)) : sum),
      ZERO,
    );
    const so = await tx.salesOrder.update({ where: { id: inv.salesOrderId }, data: { paidQuantity: paidQty.toDecimalPlaces(6) } });
    await tx.salesOrder.update({ where: { id: so.id }, data: { status: fulfilmentStatus(so) } });

    await audit(tx, actor, "Buyer payment recorded", "Invoice", inv.reference, `paid ${inv.amountPaid}`, `paid ${after.amountPaid} · ${status}`, `${payment.reference}${input.externalRef ? ` · ${input.externalRef}` : ""}`);
    return payment;
  }, TX_OPTS);
}

// ── Order close-out (§6.2) ───────────────────────────────────
// Closed only once delivered, invoiced and paid in full with nothing on the road.
export async function closeSalesOrder(soId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { shipments: true } });
    if (!so) throw new FinanceError("ORDER_NOT_FOUND");
    const open = so.shipments.filter((s) => ["PENDING", "IN_TRANSIT", "HELD"].includes(s.status));
    if (so.status !== "PAID" || open.length > 0) {
      throw new FinanceError("INVALID_STATE", `${so.reference} is ${so.status}${open.length ? ` with ${open.length} shipment(s) open` : ""}; only a fully paid order can close.`);
    }
    const closed = await tx.salesOrder.updateMany({ where: { id: soId, status: "PAID" }, data: { status: "CLOSED" } });
    if (closed.count === 0) throw new FinanceError("INVALID_STATE", `${so.reference} changed; reload.`);
    await audit(tx, actor, "Sales order closed", "SalesOrder", so.reference, "Paid", "Closed");
  }, TX_OPTS);
}

// ── Miner payouts (FR-48) ────────────────────────────────────
// Owed = QC-verified tonnes × the PO price; payouts draw it down.
export async function minerBalance(tx: Prisma.TransactionClient, poId: string) {
  const po = await tx.purchaseOrder.findUnique({
    where: { id: poId },
    include: { deliveries: { where: { status: "VERIFIED" } }, payouts: true },
  });
  if (!po) throw new FinanceError("PO_NOT_FOUND");
  const verified = po.deliveries.reduce((s, d) => s.add(d.verifiedQuantity ?? ZERO), ZERO);
  const owed = verified.mul(po.unitPrice).toDecimalPlaces(2);
  const paid = po.payouts.reduce((s, p) => s.add(p.amount), ZERO);
  return { po, owed, paid, outstanding: owed.sub(paid) };
}

/**
 * Record a payout to the miner against a PO.
 * ponytail: single full-on-QC rule; staged rules (deposit on delivery, balance
 * after QC — FR-49) need a payout schedule per miner tier.
 */
export async function recordMinerPayout(poId: string, input: PaymentInput, actor: Actor) {
  const amount = amountOf(input.amount);
  return prisma.$transaction(async (tx) => {
    // Row lock on the PO serializes payouts, so two can't both pass the balance check.
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${poId} FOR UPDATE`;
    const { po, owed, paid, outstanding } = await minerBalance(tx, poId);
    if (!["QC_PASSED", "PAYABLE"].includes(po.status)) {
      throw new FinanceError("INVALID_STATE", `${po.reference} is ${po.status}; miners are paid after QC passes.`);
    }
    if (amount.gt(outstanding)) throw new FinanceError("OVERPAYMENT", `${po.reference} has ${outstanding} outstanding; ${amount} would overpay.`);

    const payment = await tx.payment.create({
      data: {
        reference: ref("PYT"),
        type: "MINER_PAYOUT",
        amount,
        currency: po.currency,
        method: input.method || null,
        externalRef: input.externalRef || null,
        purchaseOrderId: poId,
        recordedById: actor.id,
        paidAt: input.paidAt ?? new Date(),
      },
    });
    const status = paid.add(amount).gte(owed) ? "PAID" : "PAYABLE";
    await tx.purchaseOrder.update({ where: { id: poId }, data: { status } });
    await audit(tx, actor, "Miner payout recorded", "PurchaseOrder", po.reference, `paid ${paid} of ${owed}`, `paid ${paid.add(amount)} · ${status}`, `${payment.reference}${input.externalRef ? ` · ${input.externalRef}` : ""}`);
    return payment;
  }, TX_OPTS);
}
