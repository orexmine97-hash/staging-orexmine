"use server";

import type { QcDecisionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertRole, getSessionActor } from "@/lib/auth";
import { ProcurementError, createOffer, recordQcDecision } from "@/lib/procurement";

export type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

// Procurement Officer issues offers (FR-09/10).
export async function createOfferAction(formData: FormData): Promise<ActionResult<{ purchaseOrderId: string }>> {
  const actor = await getSessionActor(); // throws until OIDC is wired
  assertRole(actor, "PROCUREMENT", "ADMIN");

  const minerId = String(formData.get("minerId") ?? "");
  const commodity = String(formData.get("commodity") ?? "");
  const quantity = String(formData.get("quantity") ?? "");
  const unitPrice = String(formData.get("unitPrice") ?? "");
  const grade = formData.get("grade") ? String(formData.get("grade")) : undefined;
  const reason = formData.get("reason") ? String(formData.get("reason")) : undefined;

  try {
    const po = await createOffer(minerId, { commodity, quantity, unitPrice, grade, reason }, actor);
    revalidatePath("/console/procurement");
    return { ok: true, purchaseOrderId: po.id };
  } catch (e) {
    if (e instanceof ProcurementError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

// Quality & Compliance records the QC decision — the gate to sellable (FR-18).
export async function recordQcDecisionAction(formData: FormData): Promise<ActionResult<{ batchId: string; batchStatus: string }>> {
  const actor = await getSessionActor();
  assertRole(actor, "QUALITY_COMPLIANCE", "ADMIN");

  const deliveryId = String(formData.get("deliveryId") ?? "");
  const decision = String(formData.get("decision") ?? "") as QcDecisionType;
  const reason = String(formData.get("reason") ?? "");

  try {
    const { batchId, batchStatus } = await recordQcDecision(deliveryId, decision, { reason }, actor);
    revalidatePath("/console/qc");
    revalidatePath("/catalog");
    return { ok: true, batchId, batchStatus };
  } catch (e) {
    if (e instanceof ProcurementError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

// acceptOffer + receiveDelivery follow the same thin-wrapper pattern (roles:
// MINER/PROCUREMENT for acceptance, WAREHOUSE_LOGISTICS/QUALITY for receiving);
// add them when the console screens that call them are built.
