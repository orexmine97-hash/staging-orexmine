"use server";

import type { QcDecisionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { ProcurementError, acceptOffer, createOffer, receiveDelivery, recordQcDecision } from "@/lib/procurement";

export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

// Auth/RBAC and domain errors are the caller's to see; anything else is a bug.
function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof ProcurementError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

// Procurement Officer issues offers (FR-09/10).
export async function createOfferAction(formData: FormData): Promise<ActionResult<{ purchaseOrderId: string }>> {
  const minerId = String(formData.get("minerId") ?? "");
  const commodity = String(formData.get("commodity") ?? "");
  const quantity = String(formData.get("quantity") ?? "");
  const unitPrice = String(formData.get("unitPrice") ?? "");
  const grade = formData.get("grade") ? String(formData.get("grade")) : undefined;
  const reason = formData.get("reason") ? String(formData.get("reason")) : undefined;

  try {
    const actor = await authorizeFor(
      { action: "offer.create", recordType: "Miner", recordId: minerId },
      "PROCUREMENT",
      "ADMIN",
    );
    const po = await createOffer(minerId, { commodity, quantity, unitPrice, grade, reason }, actor);
    revalidatePath("/console/procurement");
    return { ok: true, purchaseOrderId: po.id };
  } catch (e) {
    return toFailure(e);
  }
}

// Quality & Compliance records the QC decision — the gate to sellable (FR-18).
export async function recordQcDecisionAction(formData: FormData): Promise<ActionResult<{ batchId: string; batchStatus: string }>> {
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const decision = String(formData.get("decision") ?? "") as QcDecisionType;
  const reason = String(formData.get("reason") ?? "");

  try {
    const actor = await authorizeFor(
      { action: "qc.decision", recordType: "Delivery", recordId: deliveryId },
      "QUALITY_COMPLIANCE",
      "ADMIN",
    );
    const { batchId, batchStatus } = await recordQcDecision(deliveryId, decision, { reason }, actor);
    revalidatePath("/console/qc");
    revalidatePath("/catalog");
    return { ok: true, batchId, batchStatus };
  } catch (e) {
    return toFailure(e);
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// Procurement records the miner's acceptance of an offer (FR-11).
export async function acceptOfferAction(formData: FormData): Promise<ActionResult<object>> {
  const poId = str(formData, "purchaseOrderId");
  try {
    const actor = await authorizeFor({ action: "offer.accept", recordType: "PurchaseOrder", recordId: poId }, "PROCUREMENT", "ADMIN");
    await acceptOffer(poId, actor, str(formData, "reason") || undefined);
    revalidatePath("/console/procurement");
    revalidatePath("/console/qc");
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

// Warehouse / QC record a (possibly partial) delivery with its weighbridge figure and assay (FR-13/16).
export async function receiveDeliveryAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const poId = str(formData, "purchaseOrderId");
  try {
    const actor = await authorizeFor(
      { action: "delivery.receive", recordType: "PurchaseOrder", recordId: poId },
      "WAREHOUSE_LOGISTICS",
      "QUALITY_COMPLIANCE",
      "ADMIN",
    );
    const { delivery } = await receiveDelivery(
      poId,
      {
        declaredQuantity: str(formData, "declaredQuantity"),
        verifiedQuantity: str(formData, "verifiedQuantity"),
        location: str(formData, "location"),
        assay: {
          testedGrade: str(formData, "testedGrade"),
          laboratory: str(formData, "laboratory") || undefined,
          sampleReference: str(formData, "sampleReference") || undefined,
        },
        reason: str(formData, "reason") || undefined,
      },
      actor,
    );
    revalidatePath("/console/procurement");
    revalidatePath("/console/qc");
    revalidatePath("/console/inventory");
    return { ok: true, reference: delivery.reference };
  } catch (e) {
    return toFailure(e);
  }
}
