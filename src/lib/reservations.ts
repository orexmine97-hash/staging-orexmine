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
  const qty = new Prisma.Decimal(input.quantity);
  if (qty.lte(0)) {
    throw new ReservationError("INVALID_QUANTITY", "Reservation quantity must be positive.");
  }
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + RESERVATION_TTL_HOURS * 3_600_000);

  return prisma.$transaction(async (tx) => {
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
    // ponytail: SO.reservedQuantity roll-up is left to the sales-order flow —
    // add here (one increment) when that slice lands.
  }, {
    // A contended reservation blocks on the batch row lock; the waiter must
    // outlast the holder rather than abort with Prisma's 5s default timeout.
    // ponytail: 15s ceiling; revisit if reservation throughput ever demands it.
    timeout: 15_000,
    maxWait: 10_000,
  });
}
