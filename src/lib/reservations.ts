import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ReservationErrorCode =
  | "INVALID_QUANTITY"
  | "BATCH_NOT_FOUND"
  | "NOT_SELLABLE"
  | "INSUFFICIENT_AVAILABLE";

export class ReservationError extends Error {
  constructor(
    public code: ReservationErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ReservationError";
  }
}

export interface Actor {
  id: string;
  name: string;
  role: UserRole;
}

export interface ReserveInput {
  batchId: string;
  quantity: Prisma.Decimal.Value; // number | string | Decimal
  salesOrderId?: string;
  expiresAt?: Date;
  reason?: string;
}

// FRD 6.2: a reservation must have an expiry (or an explicit staff hold).
const RESERVATION_TTL_HOURS = 72;

function reservationRef(): string {
  // ponytail: not the human-sequential RSV-#### format. A shared running-number
  // generator is a cross-cutting concern for every entity — add a ref-sequence
  // table when the console needs readable running numbers.
  return `RSV-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

/**
 * Reserve `quantity` from a sellable batch, atomically and without double-selling.
 *
 * The guard is a single conditional UPDATE: `available >= qty` is re-checked
 * under the row lock the UPDATE holds, so a concurrent reservation that would
 * overdraw the batch matches zero rows and is rejected (FRD FR-26/FR-39). The
 * reservation, its stock movement, and the audit event are written in the same
 * transaction, so the buckets and the ledger never diverge.
 */
export async function reserveBatch(input: ReserveInput, actor: Actor) {
  return prisma.$transaction((tx) => reserveInTx(tx, input, actor), RESERVE_TX_OPTS);
}

// A contended reservation blocks on the batch row lock; the waiter must
// outlast the holder rather than abort with Prisma's 5s default timeout.
// ponytail: 15s ceiling; revisit if reservation throughput ever demands it.
export const RESERVE_TX_OPTS = { timeout: 15_000, maxWait: 10_000 };

/**
 * The reservation itself, inside a caller's transaction — so a sales-order
 * confirmation can create the SO and reserve its stock all-or-nothing.
 */
export async function reserveInTx(tx: Prisma.TransactionClient, input: ReserveInput, actor: Actor) {
  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) {
    throw new ReservationError("INVALID_QUANTITY", "Reservation quantity must be positive.");
  }
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + RESERVATION_TTL_HOURS * 3_600_000);

  // Lapsed holds on this batch give their stock back before we check what's free.
  await expireInTx(tx, input.batchId);

  const updated = await tx.inventoryBatch.updateMany({
    where: { id: input.batchId, status: "SELLABLE", availableQuantity: { gte: qty } },
    data: {
      availableQuantity: { decrement: qty },
      reservedQuantity: { increment: qty },
    },
  });

  if (updated.count === 0) {
    // Nothing changed — say precisely why.
    const b = await tx.inventoryBatch.findUnique({
      where: { id: input.batchId },
      select: { status: true, availableQuantity: true },
    });
    if (!b) throw new ReservationError("BATCH_NOT_FOUND");
    if (b.status !== "SELLABLE") {
      throw new ReservationError("NOT_SELLABLE", `Batch is ${b.status}, not sellable.`);
    }
    throw new ReservationError(
      "INSUFFICIENT_AVAILABLE",
      `Only ${b.availableQuantity} available; requested ${qty}. Reserving would double-sell.`,
    );
  }

  const reservation = await tx.reservation.create({
    data: {
      reference: reservationRef(),
      batchId: input.batchId,
      salesOrderId: input.salesOrderId,
      status: "ACTIVE",
      quantity: qty,
      expiresAt,
      createdById: actor.id,
    },
  });

  await tx.stockMovement.create({
    data: {
      batchId: input.batchId,
      type: "RESERVE",
      quantity: qty,
      reason: input.reason ?? "Reservation created",
      refType: "Reservation",
      refId: reservation.id,
      actorId: actor.id,
      actorName: actor.name,
    },
  });

  const after = await tx.inventoryBatch.findUniqueOrThrow({
    where: { id: input.batchId },
    select: { availableQuantity: true, reservedQuantity: true },
  });
  await tx.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "Reservation created",
      recordType: "Reservation",
      recordId: reservation.reference,
      before: `available ${after.availableQuantity.add(qty)}`,
      after: `available ${after.availableQuantity} · reserved ${after.reservedQuantity}`,
      reason: input.reason ?? "Reservation created",
    },
  });

  return reservation;
}

// Expiry runs without a signed-in user; audited under this system identity.
export const SYSTEM_ACTOR: Actor = { id: "system", name: "System (reservation expiry)", role: "ADMIN" };

/**
 * Give a reservation's stock back to available (FRD §9: expiry, cancellation
 * and manual release all move stock through an audited RELEASE movement).
 *
 * The ACTIVE → RELEASED/EXPIRED flip is conditional, so a reservation is
 * released at most once even when a sweep and a staff release race. Returns
 * null when it was no longer active. A linked SO's reserved bucket follows;
 * a RESERVED order left holding nothing drops back to CONFIRMED so the desk
 * can re-reserve or cancel it.
 */
export async function releaseInTx(
  tx: Prisma.TransactionClient,
  reservationId: string,
  outcome: "RELEASED" | "EXPIRED",
  reason: string,
  actor: Actor,
) {
  const flipped = await tx.reservation.updateMany({
    where: { id: reservationId, status: "ACTIVE" },
    data: { status: outcome, releaseReason: reason },
  });
  if (flipped.count === 0) return null;
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: reservationId } });

  const after = await tx.inventoryBatch.update({
    where: { id: r.batchId },
    data: {
      availableQuantity: { increment: r.quantity },
      reservedQuantity: { decrement: r.quantity },
    },
    select: { availableQuantity: true, reservedQuantity: true },
  });

  await tx.stockMovement.create({
    data: {
      batchId: r.batchId,
      type: "RELEASE",
      quantity: r.quantity,
      reason,
      refType: "Reservation",
      refId: r.id,
      actorId: actor.id,
      actorName: actor.name,
    },
  });

  if (r.salesOrderId) {
    const so = await tx.salesOrder.update({
      where: { id: r.salesOrderId },
      data: { reservedQuantity: { decrement: r.quantity } },
    });
    if (so.status === "RESERVED" && so.reservedQuantity.lte(0)) {
      await tx.salesOrder.update({ where: { id: so.id }, data: { status: "CONFIRMED" } });
    }
  }

  await tx.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: outcome === "EXPIRED" ? "Reservation expired" : "Reservation released",
      recordType: "Reservation",
      recordId: r.reference,
      before: `available ${after.availableQuantity.sub(r.quantity)} · reserved ${after.reservedQuantity.add(r.quantity)}`,
      after: `available ${after.availableQuantity} · reserved ${after.reservedQuantity}`,
      reason,
    },
  });

  return r;
}

export async function expireInTx(tx: Prisma.TransactionClient, batchId?: string) {
  const lapsed = await tx.reservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lt: new Date() }, ...(batchId && { batchId }) },
    select: { id: true },
    orderBy: { batchId: "asc" }, // consistent lock order, so two sweeps can't deadlock
  });
  for (const { id } of lapsed) {
    await releaseInTx(tx, id, "EXPIRED", "Reservation expired", SYSTEM_ACTOR);
  }
  return lapsed.length;
}

/**
 * Release every lapsed reservation. Called lazily (trade desk render, and per
 * batch before each reservation) so stock never stays stuck behind a dead hold.
 * ponytail: no scheduler — the catalog can under-report available stock until
 * the next sweep; add a cron route calling this if that lag ever matters.
 */
export function expireReservations() {
  return prisma.$transaction((tx) => expireInTx(tx), RESERVE_TX_OPTS);
}
