"use server";

import { revalidatePath } from "next/cache";
import { assertRole, getSessionActor } from "@/lib/auth";
import { ReservationError, reserveBatch } from "@/lib/reservations";

export type ReserveResult =
  | { ok: true; reservationId: string }
  | { ok: false; code: string; message: string };

/**
 * Trade Desk reserves stock against a confirmed order. Auth + RBAC are checked
 * here because a server action is reachable by direct POST, not only via the UI.
 */
export async function reserveBatchAction(formData: FormData): Promise<ReserveResult> {
  const actor = await getSessionActor(); // throws until OIDC is wired
  assertRole(actor, "SALES", "ADMIN");

  const batchId = String(formData.get("batchId") ?? "");
  const quantity = String(formData.get("quantity") ?? "");
  const salesOrderId = formData.get("salesOrderId")
    ? String(formData.get("salesOrderId"))
    : undefined;
  const reason = formData.get("reason") ? String(formData.get("reason")) : undefined;

  try {
    const reservation = await reserveBatch({ batchId, quantity, salesOrderId, reason }, actor);
    revalidatePath("/catalog");
    return { ok: true, reservationId: reservation.id };
  } catch (e) {
    if (e instanceof ReservationError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}
