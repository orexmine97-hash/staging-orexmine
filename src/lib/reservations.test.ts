// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ReservationError, reserveBatch } from "@/lib/reservations";

const actor = { id: "test-actor", name: "Test Sales", role: "SALES" as const };
const createdBatchIds: string[] = [];

async function makeBatch(available: number, status: "SELLABLE" | "QC_HOLD" = "SELLABLE") {
  const b = await prisma.inventoryBatch.create({
    data: {
      batchNumber: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      commodity: "gold",
      grade: "80",
      location: "test-harness",
      status,
      quantity: available,
      availableQuantity: status === "SELLABLE" ? available : 0,
    },
  });
  createdBatchIds.push(b.id);
  return b;
}

// Integration test — needs a real Postgres. Gated on RUN_DB_TESTS (set only in
// .env.staging) so plain `npm test` stays green without a DB. Run it with
// `npm run test:integration`.
describe.skipIf(!process.env.RUN_DB_TESTS)("reserveBatch — atomic, no double-sell", () => {
  // Generous timeouts: the CI/dev DB may be a remote (Supabase) instance where
  // each round trip is ~1s; these are integration tests, not unit tests.
  afterAll(async () => {
    for (const id of createdBatchIds) {
      await prisma.stockMovement.deleteMany({ where: { batchId: id } });
      await prisma.reservation.deleteMany({ where: { batchId: id } });
      await prisma.inventoryBatch.delete({ where: { id } }).catch(() => {});
    }
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 30_000);

  it("lets exactly one of two racing reservations win", async () => {
    const b = await makeBatch(10);

    const results = await Promise.allSettled([
      reserveBatch({ batchId: b.id, quantity: 6 }, actor),
      reserveBatch({ batchId: b.id, quantity: 6 }, actor),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ReservationError);
    expect(rejected[0].reason.code).toBe("INSUFFICIENT_AVAILABLE");

    const after = await prisma.inventoryBatch.findUniqueOrThrow({ where: { id: b.id } });
    expect(Number(after.availableQuantity)).toBe(4);
    expect(Number(after.reservedQuantity)).toBe(6);

    expect(await prisma.reservation.count({ where: { batchId: b.id, status: "ACTIVE" } })).toBe(1);
    expect(await prisma.stockMovement.count({ where: { batchId: b.id, type: "RESERVE" } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { recordType: "Reservation", actorId: actor.id } })).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("refuses a non-sellable batch", async () => {
    const b = await makeBatch(10, "QC_HOLD");
    await expect(reserveBatch({ batchId: b.id, quantity: 1 }, actor)).rejects.toMatchObject({
      code: "NOT_SELLABLE",
    });
  });

  it("refuses over-reservation on a single call", async () => {
    const b = await makeBatch(5);
    await expect(reserveBatch({ batchId: b.id, quantity: 6 }, actor)).rejects.toMatchObject({
      code: "INSUFFICIENT_AVAILABLE",
    });
  });
});
