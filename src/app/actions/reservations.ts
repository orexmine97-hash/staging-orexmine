"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { ReservationError, reserveBatch } from "@/lib/reservations";

export type ReserveResult =
  | { ok: true; reservationId: string }
  | { ok: false; code: string; message: string };

/**
 * Trade Desk reserves stock against a confirmed order. Auth + RBAC are checked
 * here because a server action is reachable by direct POST, not only via the UI.
 */
export async function reserveBatchAction(formData: FormData): Promise<ReserveResult> {
  const batchId = String(formData.get("batchId") ?? "");
  const quantity = String(formData.get("quantity") ?? "");
  const salesOrderId = formData.get("salesOrderId")
    ? String(formData.get("salesOrderId"))
    : undefined;
  const reason = formData.get("reason") ? String(formData.get("reason")) : undefined;

  try {
    const actor = await authorizeFor(
      { action: "reservation.create", recordType: "InventoryBatch", recordId: batchId },
      "SALES",
      "ADMIN",
    );
    const reservation = await reserveBatch({ batchId, quantity, salesOrderId, reason }, actor);
    revalidatePath("/catalog");
    return { ok: true, reservationId: reservation.id };
  } catch (e) {
    if (e instanceof AuthError || e instanceof ReservationError) {
      return { ok: false, code: e.code, message: e.message };
    }
    if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
      return { ok: false, code: "FORBIDDEN", message: e.message };
    }
    throw e;
  }
}
