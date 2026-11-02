"use server";

import type { KycStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AuthError, getSessionActor } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { ReservationError } from "@/lib/reservations";
import {
  SalesError,
  type QuoteTerms,
  cancelSalesOrder,
  confirmQuote,
  createQuote,
  declineQuote,
  issueQuote,
  reReserveOrder,
  releaseOrderStock,
  requestQuote,
  setBuyerKyc,
} from "@/lib/sales";
import type { ActionResult } from "./procurement";

// Auth/RBAC and domain errors are the caller's to see; anything else is a bug.
function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof SalesError || e instanceof ReservationError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function terms(fd: FormData): QuoteTerms {
  return {
    quantity: str(fd, "quantity"),
    unitPrice: str(fd, "unitPrice"),
    validDays: Number(str(fd, "validDays")) || undefined,
    deliveryTerms: str(fd, "deliveryTerms"),
    destination: str(fd, "destination"),
  };
}

function refreshSales() {
  revalidatePath("/console/trade-desk");
  revalidatePath("/console/buyers");
  revalidatePath("/console/inventory");
  revalidatePath("/catalog", "layout");
}

// Trade desk approves / suspends / rejects buyer KYC (FR-31).
export async function setBuyerKycAction(formData: FormData): Promise<ActionResult<object>> {
  const buyerId = str(formData, "buyerId");
  try {
    const actor = await authorizeFor({ action: "buyer.kyc", recordType: "Buyer", recordId: buyerId }, "SALES", "ADMIN");
    await setBuyerKyc(buyerId, str(formData, "status") as KycStatus, str(formData, "reason"), actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

// An approved buyer asks for a quote from the batch page (FR-86).
export async function requestQuoteAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  try {
    const actor = await getSessionActor();
    if (actor.role !== "BUYER") {
      return { ok: false, code: "NOT_A_BUYER", message: "Only buyer accounts can request quotes. Staff create quotes in the trade desk." };
    }
    const quote = await requestQuote(actor.id, str(formData, "batchId"), str(formData, "quantity"), actor);
    revalidatePath("/console/trade-desk");
    return { ok: true, reference: quote.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function createQuoteAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const buyerId = str(formData, "buyerId");
  try {
    const actor = await authorizeFor({ action: "quote.create", recordType: "Buyer", recordId: buyerId }, "SALES", "ADMIN");
    const quote = await createQuote(buyerId, str(formData, "batchId"), terms(formData), actor);
    refreshSales();
    return { ok: true, reference: quote.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function issueQuoteAction(formData: FormData): Promise<ActionResult<object>> {
  const quoteId = str(formData, "quoteId");
  try {
    const actor = await authorizeFor({ action: "quote.issue", recordType: "Quote", recordId: quoteId }, "SALES", "ADMIN");
    await issueQuote(quoteId, terms(formData), actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

export async function declineQuoteAction(formData: FormData): Promise<ActionResult<object>> {
  const quoteId = str(formData, "quoteId");
  try {
    const actor = await authorizeFor({ action: "quote.decline", recordType: "Quote", recordId: quoteId }, "SALES", "ADMIN");
    await declineQuote(quoteId, str(formData, "reason"), actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

// Records the buyer's confirmation: SO + reservation, all-or-nothing (FR-38/39).
// ponytail: staff record it on the buyer's behalf until the buyer portal exists;
// that portal will call the same confirmQuote.
export async function confirmQuoteAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const quoteId = str(formData, "quoteId");
  try {
    const actor = await authorizeFor({ action: "quote.confirm", recordType: "Quote", recordId: quoteId }, "SALES", "ADMIN");
    const so = await confirmQuote(quoteId, actor);
    refreshSales();
    return { ok: true, reference: so.reference };
  } catch (e) {
    return toFailure(e);
  }
}

// Order exceptions (FR-40): release held stock, re-hold it, or cancel.
export async function releaseOrderStockAction(formData: FormData): Promise<ActionResult<object>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "order.release", recordType: "SalesOrder", recordId: soId }, "SALES", "ADMIN");
    await releaseOrderStock(soId, str(formData, "reason"), actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

export async function reReserveOrderAction(formData: FormData): Promise<ActionResult<object>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "order.reserve", recordType: "SalesOrder", recordId: soId }, "SALES", "ADMIN");
    await reReserveOrder(soId, actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

export async function cancelSalesOrderAction(formData: FormData): Promise<ActionResult<object>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "order.cancel", recordType: "SalesOrder", recordId: soId }, "SALES", "ADMIN");
    await cancelSalesOrder(soId, str(formData, "reason"), actor);
    refreshSales();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
