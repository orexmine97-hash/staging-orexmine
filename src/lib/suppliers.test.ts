// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOffer } from "@/lib/procurement";
import { blockingDocuments, defaultReviewDate, recordMinerDocument, registerMiner, tierFor, vetMiner } from "@/lib/suppliers";

describe("supplier rules", () => {
  it("maps the 0–100 total to a tier (FR-04)", () => {
    expect(tierFor(100)).toBe("PREFERRED");
    expect(tierFor(85)).toBe("PREFERRED");
    expect(tierFor(84)).toBe("CONDITIONAL");
    expect(tierFor(80)).toBe("CONDITIONAL");
    expect(tierFor(79)).toBe("PROBATIONARY");
    expect(tierFor(60)).toBe("PROBATIONARY");
    expect(tierFor(59)).toBe("NOT_ONBOARDED");
  });

  it("sets the review date by tier (FR-06)", () => {
    const from = new Date("2026-01-15T00:00:00Z");
    expect(defaultReviewDate("PREFERRED", from).toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(defaultReviewDate("PROBATIONARY", from).toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("blocks on any document not on file or past expiry (§9)", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const docs = [
      { name: "A", state: "ON_FILE" as const, expiresAt: null },
      { name: "B", state: "ON_FILE" as const, expiresAt: new Date("2026-05-01T00:00:00Z") },
      { name: "C", state: "PENDING" as const, expiresAt: null },
      { name: "D", state: "ON_FILE" as const, expiresAt: new Date("2027-01-01T00:00:00Z") },
    ];
    expect(blockingDocuments(docs, now)).toEqual(["B", "C"]);
  });
});

const actor = { id: "test-supplier-actor", name: "Test Procurement", role: "PROCUREMENT" as const };

describe.skipIf(!process.env.RUN_DB_TESTS)("suppliers — register -> document -> vet -> offer", () => {
  const minerIds: string[] = [];
  afterAll(async () => {
    const miners = await prisma.miner.findMany({ where: { id: { in: minerIds } }, include: { documents: true } });
    const docIds = miners.flatMap((m) => m.documents.map((d) => d.id));
    await prisma.purchaseOrder.deleteMany({ where: { minerId: { in: minerIds } } });
    await prisma.document.deleteMany({ where: { minerDocumentId: { in: docIds } } });
    await prisma.minerDocument.deleteMany({ where: { id: { in: docIds } } });
    await prisma.miner.deleteMany({ where: { id: { in: minerIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: miners.map((m) => m.organizationId) } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: actor.id } });
    await prisma.$disconnect();
  }, 30_000);

  it("only offers once scored into an offerable tier with every document on file", async () => {
    const miner = await registerMiner({ name: `T Supplier ${Date.now()}`, scale: "ARTISANAL", commodities: ["gold"], monthlyCapTonnes: "50" }, actor);
    minerIds.push(miner.id);
    const offer = () => createOffer(miner.id, { commodity: "gold", quantity: 10, unitPrice: 10_000_000 }, actor);

    await expect(offer()).rejects.toMatchObject({ code: "MINER_NOT_APPROVED" });

    const vetted = await vetMiner(miner.id, { legal: 23, source: 21, quality: 22, reliability: 20 }, "Site visit + title check", actor);
    expect(vetted.tier).toBe("PREFERRED");
    expect((await prisma.organization.findUnique({ where: { id: miner.organizationId } }))?.status).toBe("ACTIVE");

    await expect(offer()).rejects.toMatchObject({ code: "DOCUMENTS_BLOCKING" });

    const docs = await prisma.minerDocument.findMany({ where: { minerId: miner.id } });
    for (const d of docs) await recordMinerDocument(d.id, "ON_FILE", { reference: `REF-${d.id.slice(-4)}` }, actor);
    const po = await offer();
    expect(po.status).toBe("OFFERED");

    const trail = await prisma.auditEvent.count({ where: { recordType: "Miner", recordId: miner.reference } });
    expect(trail).toBe(1 + 1 + docs.length); // registered, vetted, each document
  }, 30_000);
});
