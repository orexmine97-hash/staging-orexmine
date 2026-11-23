"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { LogisticsError, deliverShipment, dispatchOrder, returnShipment } from "@/lib/logistics";
import type { ActionResult } from "./procurement";

// Auth/RBAC and domain errors are the caller's to see; anything else is a bug.
function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof LogisticsError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function refreshLogistics() {
  revalidatePath("/console/logistics");
  revalidatePath("/console/trade-desk");
  revalidatePath("/console/inventory");
}

export async function dispatchOrderAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  const soId = str(formData, "soId");
  try {
    const actor = await authorizeFor({ action: "shipment.dispatch", recordType: "SalesOrder", recordId: soId }, "WAREHOUSE_LOGISTICS", "ADMIN");
    const expected = str(formData, "expectedAt");
    const shipment = await dispatchOrder(
      soId,
      {
        quantity: str(formData, "quantity"),
        carrier: str(formData, "carrier"),
        trackingRef: str(formData, "trackingRef"),
        route: str(formData, "route"),
        expectedAt: expected ? new Date(expected) : undefined,
        cost: str(formData, "cost") || undefined,
      },
      actor,
    );
    refreshLogistics();
    return { ok: true, reference: shipment.reference };
  } catch (e) {
    return toFailure(e);
  }
}

export async function deliverShipmentAction(formData: FormData): Promise<ActionResult<object>> {
  const shipmentId = str(formData, "shipmentId");
  try {
    const actor = await authorizeFor({ action: "shipment.deliver", recordType: "Shipment", recordId: shipmentId }, "WAREHOUSE_LOGISTICS", "ADMIN");
    await deliverShipment(shipmentId, str(formData, "pod"), actor);
    refreshLogistics();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

export async function returnShipmentAction(formData: FormData): Promise<ActionResult<object>> {
  const shipmentId = str(formData, "shipmentId");
  try {
    const actor = await authorizeFor({ action: "shipment.return", recordType: "Shipment", recordId: shipmentId }, "WAREHOUSE_LOGISTICS", "ADMIN");
    await returnShipment(shipmentId, str(formData, "reason"), actor);
    refreshLogistics();
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
