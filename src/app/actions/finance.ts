"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { FinanceError, type PaymentInput, closeSalesOrder, issueInvoice, recordBuyerPayment, recordMinerPayout } from "@/lib/finance";
import type { ActionResult } from "./procurement";

// Auth/RBAC and domain errors are the caller's to see; anything else is a bug.
function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof FinanceError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function payment(fd: FormData): PaymentInput {
  const paidAt = str(fd, "paidAt");
  return { amount: str(fd, "amount"), method: str(fd, "method"), externalRef: str(fd, "externalRef"), paidAt: paidAt ? new Date(paidAt) : undefined };
}

function refreshFinance() {
  revalidatePath("/console/finance");
  revalidatePath("/console/trade-desk");
  revalidatePath("/console/procurement");
}

export async function issueInvoiceAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "invoice.issue", recordType: "SalesOrder", recordId: soId }, "FINANCE", "ADMIN");
    const inv = await issueInvoice(soId, { dueDays: Number(str(formData, "dueDays")) || undefined, externalRef: str(formData, "externalRef") }, actor);
    refreshFinance();
    return { ok: true, reference: inv.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function recordBuyerPaymentAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const invoiceId = str(formData, "invoiceId");
  try {
    const actor = await authorizeFor({ action: "payment.receipt", recordType: "Invoice", recordId: invoiceId }, "FINANCE", "ADMIN");
    const p = await recordBuyerPayment(invoiceId, payment(formData), actor);
    refreshFinance();
    return { ok: true, reference: p.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function recordMinerPayoutAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const poId = str(formData, "poId");
  try {
    const actor = await authorizeFor({ action: "payment.payout", recordType: "PurchaseOrder", recordId: poId }, "FINANCE", "ADMIN");
    const p = await recordMinerPayout(poId, payment(formData), actor);
    refreshFinance();
    return { ok: true, reference: p.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function closeSalesOrderAction(formData: FormData): Promise<ActionResult<object>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "order.close", recordType: "SalesOrder", recordId: soId }, "FINANCE", "ADMIN");
    await closeSalesOrder(soId, actor);
    refreshFinance();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
