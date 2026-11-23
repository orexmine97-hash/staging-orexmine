import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, ref } from "@/lib/procurement";
import { type Actor, RESERVE_TX_OPTS } from "@/lib/reservations";
import { fulfilmentStatus } from "@/lib/sales";

export type LogisticsErrorCode =
  | "INVALID_QUANTITY"
  | "ORDER_NOT_FOUND"
  | "SHIPMENT_NOT_FOUND"
  | "INVALID_STATE"
  | "OVER_DISPATCH"
  | "POD_REQUIRED"
  | "REASON_REQUIRED";

export class LogisticsError extends Error {
  constructor(
    public code: LogisticsErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "LogisticsError";
  }
}

type Tx = Prisma.TransactionClient;

export interface DispatchInput {
  quantity: Prisma.Decimal.Value;
  carrier?: string;
  trackingRef?: string;
  route?: string;
  expectedAt?: Date;
  cost?: Prisma.Decimal.Value;
}

// Shipments still on the road; delivery or return closes them.
const OPEN_SHIPMENT = ["PENDING", "IN_TRANSIT", "HELD"] as const;

/**
 * Ship part or all of what's held for an order (FR-56/57). Draws the
 * reservation down (fully used holds become CONSUMED), moves tonnes from the
 * batch's reserved bucket to dispatched, and opens an IN_TRANSIT shipment —
 * one transaction, so a shipment never exists without the stock behind it.
 *
 * Locks run reservation → order → batch, the same order as a release, so a
 * dispatch racing an expiry sweep serializes instead of deadlocking.
 */
export async function dispatchOrder(soId: string, input: DispatchInput, actor: Actor) {
  let qty: Prisma.Decimal;
  try {
    qty = new Prisma.Decimal(input.quantity);
  } catch {
    throw new LogisticsError("INVALID_QUANTITY", "Quantity must be a number.");
  }
  if (qty.lte(0)) throw new LogisticsError("INVALID_QUANTITY", "Dispatch quantity must be positive.");

  return prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.findUnique({ where: { id: soId }, include: { batch: { select: { batchNumber: true } } } });
    if (!so) throw new LogisticsError("ORDER_NOT_FOUND");
    if (so.status !== "RESERVED" && so.status !== "PARTIAL") {
      throw new LogisticsError("INVALID_STATE", `${so.reference} is ${so.status}; only an order with reserved stock can ship.`);
    }

    // Draw down the order's holds, oldest first. Each update is guarded on the
    // hold's current state, so a concurrent release or dispatch fails us cleanly.
    const holds = await tx.reservation.findMany({ where: { salesOrderId: soId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    const held = holds.reduce((sum, h) => sum.add(h.quantity), new Prisma.Decimal(0));
    if (qty.gt(held)) throw new LogisticsError("OVER_DISPATCH", `Only ${held} t is reserved for ${so.reference}; re-reserve before shipping more.`);
    let left = qty;
    for (const h of holds) {
      if (left.lte(0)) break;
      const take = Prisma.Decimal.min(h.quantity, left);
      const used = await tx.reservation.updateMany({
        where: { id: h.id, status: "ACTIVE", quantity: h.quantity },
        data: { quantity: h.quantity.sub(take), ...(take.eq(h.quantity) && { status: "CONSUMED" }) },
      });
      if (used.count === 0) throw new LogisticsError("INVALID_STATE", `${h.reference} changed while dispatching; reload and retry.`);
      left = left.sub(take);
    }

    const moved = await tx.salesOrder.updateMany({
      where: { id: soId, reservedQuantity: { gte: qty } },
      data: { reservedQuantity: { decrement: qty }, dispatchedQuantity: { increment: qty } },
    });
    if (moved.count === 0) throw new LogisticsError("INVALID_STATE", `${so.reference} changed while dispatching; reload and retry.`);
    const after = await tx.salesOrder.findUniqueOrThrow({ where: { id: soId } });
    const status = fulfilmentStatus(after);
    await tx.salesOrder.update({ where: { id: soId }, data: { status } });

    await tx.inventoryBatch.update({
      where: { id: so.batchId },
      data: { reservedQuantity: { decrement: qty }, dispatchedQuantity: { increment: qty } },
    });

    const shipment = await tx.shipment.create({
      data: {
        reference: ref("SHP"),
        direction: "OUTBOUND",
        status: "IN_TRANSIT",
        salesOrderId: soId,
        quantity: qty,
        carrier: input.carrier || null,
        trackingRef: input.trackingRef || null,
        route: input.route || null,
        expectedAt: input.expectedAt ?? null,
        cost: input.cost ? new Prisma.Decimal(input.cost) : null,
      },
    });
    await tx.stockMovement.create({
      data: {
        batchId: so.batchId,
        type: "DISPATCH",
        quantity: qty,
        reason: `Dispatched on ${shipment.reference} for ${so.reference}`,
        refType: "Shipment",
        refId: shipment.id,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await audit(tx, actor, "Shipment dispatched", "Shipment", shipment.reference, `${so.reference} ${so.status}`, `${status} · ${qty} t of ${so.batch.batchNumber} in transit`);
    return shipment;
  }, RESERVE_TX_OPTS);
}

// Close an open outbound shipment exactly once; returns it with its order.
async function closeShipment(tx: Tx, shipmentId: string, status: "DELIVERED" | "RETURNED", podReference?: string) {
  const shipment = await tx.shipment.findUnique({ where: { id: shipmentId }, include: { salesOrder: true } });
  if (!shipment) throw new LogisticsError("SHIPMENT_NOT_FOUND");
  const so = shipment.salesOrder;
  if (!so || shipment.quantity == null) {
    throw new LogisticsError("INVALID_STATE", `${shipment.reference} isn't an outbound order shipment with a recorded quantity.`);
  }
  const closed = await tx.shipment.updateMany({
    where: { id: shipmentId, status: { in: [...OPEN_SHIPMENT] } },
    data: { status, ...(podReference && { podReference }) },
  });
  if (closed.count === 0) throw new LogisticsError("INVALID_STATE", `${shipment.reference} is ${shipment.status}; it's already closed.`);
  return { shipment, so, qty: shipment.quantity };
}

// Proof of delivery is mandatory: the delivered bucket feeds invoicing (FR-57).
export async function deliverShipment(shipmentId: string, podReference: string, actor: Actor) {
  if (!podReference.trim()) throw new LogisticsError("POD_REQUIRED", "Record the proof-of-delivery reference (signed waybill, receipt no.).");

  return prisma.$transaction(async (tx) => {
    const { shipment, so, qty } = await closeShipment(tx, shipmentId, "DELIVERED", podReference.trim());
    const after = await tx.salesOrder.update({ where: { id: so.id }, data: { deliveredQuantity: { increment: qty } } });
    const status = fulfilmentStatus(after);
    await tx.salesOrder.update({ where: { id: so.id }, data: { status } });
    await tx.inventoryBatch.update({
      where: { id: so.batchId },
      data: { dispatchedQuantity: { decrement: qty }, deliveredQuantity: { increment: qty } },
    });
    await tx.stockMovement.create({
      data: {
        batchId: so.batchId,
        type: "DELIVER",
        quantity: qty,
        reason: `Delivered on ${shipment.reference} · POD ${podReference.trim()}`,
        refType: "Shipment",
        refId: shipment.id,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await audit(tx, actor, "Shipment delivered", "Shipment", shipment.reference, shipment.status, `Delivered · ${status}`, `POD ${podReference.trim()}`);
  }, RESERVE_TX_OPTS);
}

/**
 * Failed delivery / return: the tonnes come back off the order and into the
 * batch's held bucket — returned goods aren't sellable until re-inspected.
 * ponytail: held stock has no QC re-release path yet; add one with the
 * compliance slice. Damage/loss write-offs land there too.
 */
export async function returnShipment(shipmentId: string, reason: string, actor: Actor) {
  if (!reason.trim()) throw new LogisticsError("REASON_REQUIRED", "A reason is required for a failed delivery or return.");

  return prisma.$transaction(async (tx) => {
    const { shipment, so, qty } = await closeShipment(tx, shipmentId, "RETURNED");
    const after = await tx.salesOrder.update({
      where: { id: so.id },
      data: { dispatchedQuantity: { decrement: qty }, exceptionNote: `${shipment.reference} returned: ${reason}` },
    });
    const status = fulfilmentStatus(after);
    await tx.salesOrder.update({ where: { id: so.id }, data: { status } });
    await tx.inventoryBatch.update({
      where: { id: so.batchId },
      data: { dispatchedQuantity: { decrement: qty }, heldQuantity: { increment: qty } },
    });
    await tx.stockMovement.create({
      data: {
        batchId: so.batchId,
        type: "RETURN",
        quantity: qty,
        reason: `Returned on ${shipment.reference}: ${reason}`,
        refType: "Shipment",
        refId: shipment.id,
        actorId: actor.id,
        actorName: actor.name,
      },
    });
    await audit(tx, actor, "Shipment returned", "Shipment", shipment.reference, shipment.status, `Returned · ${qty} t held for inspection · ${status}`, reason);
  }, RESERVE_TX_OPTS);
}
