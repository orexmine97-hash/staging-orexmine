import { Prisma, type MinerDocumentState, type MinerScale, type MinerTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, ref } from "@/lib/procurement";
import type { Actor } from "@/lib/reservations";

export type SupplierErrorCode = "INVALID_INPUT" | "MINER_NOT_FOUND" | "DOCUMENT_NOT_FOUND" | "REASON_REQUIRED";

export class SupplierError extends Error {
  constructor(
    public code: SupplierErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "SupplierError";
  }
}

const TX_OPTS = { timeout: 15_000, maxWait: 10_000 };

// FR-02 / FR-05: required documents per miner scale, seeded as MISSING rows at registration.
export const CHECKLIST: Record<MinerScale, string[]> = {
  ARTISANAL: ["Mining title certificate", "CAC / cooperative registration", "Tax clearance", "Bank details confirmation"],
  CORPORATE: [
    "Mining title certificate",
    "CAC registration",
    "Tax clearance",
    "Bank details confirmation",
    "Community Development Agreement (CDA)",
    "Environmental permit",
    "Assay report",
  ],
};

// FR-03/04: four pillars scored 0–25 (each pillar's 0–2 criteria rolled up), total 0–100.
// ponytail: thresholds and review cadence are constants; admin-editable config is FR-79 (Phase 2).
export const PILLAR_MAX = 25;
const TIER_FLOOR: [MinerTier, number][] = [
  ["PREFERRED", 85],
  ["CONDITIONAL", 80],
  ["PROBATIONARY", 60],
];
// FR-06: months until the next review, by tier.
const REVIEW_MONTHS: Record<MinerTier, number> = { PREFERRED: 12, CONDITIONAL: 6, PROBATIONARY: 3, NOT_ONBOARDED: 1 };

export function tierFor(total: number): MinerTier {
  return TIER_FLOOR.find(([, floor]) => total >= floor)?.[0] ?? "NOT_ONBOARDED";
}

export function defaultReviewDate(tier: MinerTier, from = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + REVIEW_MONTHS[tier]);
  return d;
}

// §9: a miner with an expired or not-on-file required document cannot receive a new offer.
export function blockingDocuments(
  docs: { name: string; state: MinerDocumentState; expiresAt: Date | null }[],
  now = new Date(),
): string[] {
  return docs.filter((d) => d.state !== "ON_FILE" || (d.expiresAt && d.expiresAt < now)).map((d) => d.name);
}

const total = (m: { scoreLegal: number | null; scoreSource: number | null; scoreQuality: number | null; scoreReliability: number | null }) =>
  m.scoreLegal == null ? null : (m.scoreLegal ?? 0) + (m.scoreSource ?? 0) + (m.scoreQuality ?? 0) + (m.scoreReliability ?? 0);

// ── Registration (FR-01) ─────────────────────────────────────
export interface MinerInput {
  name: string;
  scale: MinerScale;
  commodities: string[];
  miningTitleReference?: string;
  rcNumber?: string;
  siteDescription?: string;
  siteLatitude?: string;
  siteLongitude?: string;
  bankAccountRef?: string;
  monthlyCapTonnes?: string;
}

function coord(v: string | undefined, max: number, what: string) {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > max) throw new SupplierError("INVALID_INPUT", `${what} must be between -${max} and ${max}.`);
  return new Prisma.Decimal(v);
}

export async function registerMiner(input: MinerInput, actor: Actor) {
  const name = input.name.trim();
  if (!name) throw new SupplierError("INVALID_INPUT", "Supplier name is required.");
  if (!CHECKLIST[input.scale]) throw new SupplierError("INVALID_INPUT", "Choose artisanal or corporate.");
  if (input.commodities.length === 0) throw new SupplierError("INVALID_INPUT", "Select at least one commodity.");
  const lat = coord(input.siteLatitude, 90, "Latitude");
  const lng = coord(input.siteLongitude, 180, "Longitude");
  const cap = input.monthlyCapTonnes ? Number(input.monthlyCapTonnes) : null;
  if (cap != null && !(cap >= 0)) throw new SupplierError("INVALID_INPUT", "Monthly cap must be zero or more.");

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, type: "MINER", status: "PENDING" } });
    const miner = await tx.miner.create({
      data: {
        organizationId: org.id,
        reference: ref("MIN"),
        scale: input.scale,
        commodities: input.commodities,
        miningTitleReference: input.miningTitleReference || null,
        rcNumber: input.rcNumber || null,
        siteDescription: input.siteDescription || null,
        siteLatitude: lat,
        siteLongitude: lng,
        bankAccountRef: input.bankAccountRef || null,
        monthlyCapTonnes: cap,
        documents: { create: CHECKLIST[input.scale].map((n) => ({ name: n })) },
      },
    });
    await audit(tx, actor, "Supplier registered", "Miner", miner.reference, "—", `${name} · ${input.scale} · NOT_ONBOARDED`);
    return miner;
  }, TX_OPTS);
}

// ── Checklist documents (FR-02) ──────────────────────────────
// ponytail: records the document reference (file no. / storage path), not the binary —
// same as POD on shipments. Wire object storage onto Document.storageKey when it exists.
export async function recordMinerDocument(
  minerDocumentId: string,
  state: MinerDocumentState,
  opts: { reference?: string; expiresAt?: Date | null; reason?: string },
  actor: Actor,
) {
  if (!["ON_FILE", "PENDING", "EXPIRED", "MISSING"].includes(state)) throw new SupplierError("INVALID_INPUT", `Unknown state ${state}.`);
  const reference = opts.reference?.trim();
  if (state === "ON_FILE" && !reference) throw new SupplierError("INVALID_INPUT", "Record the document reference to mark it on file.");
  if (state !== "ON_FILE" && !opts.reason?.trim()) throw new SupplierError("REASON_REQUIRED", "Give a reason for this document state.");

  return prisma.$transaction(async (tx) => {
    const doc = await tx.minerDocument.findUnique({ where: { id: minerDocumentId }, include: { miner: { select: { reference: true } } } });
    if (!doc) throw new SupplierError("DOCUMENT_NOT_FOUND");
    const updated = await tx.minerDocument.update({
      where: { id: minerDocumentId },
      data: {
        state,
        ...(opts.expiresAt !== undefined && { expiresAt: opts.expiresAt }),
        ...(reference && { documents: { create: { kind: "REF", name: reference, uploadedById: actor.id } } }),
      },
    });
    await audit(
      tx, actor, `Supplier document ${state.toLowerCase()}`, "Miner", doc.miner.reference,
      `${doc.name}: ${doc.state}`, `${doc.name}: ${state}${reference ? ` · ${reference}` : ""}`, opts.reason?.trim() || reference,
    );
    return updated;
  }, TX_OPTS);
}

// ── Vetting score → tier → review date (FR-03/04/06/08) ──────
export interface Scores {
  legal: number;
  source: number;
  quality: number;
  reliability: number;
}

export async function vetMiner(minerId: string, scores: Scores, reason: string, actor: Actor, nextReviewAt?: Date) {
  const values = [scores.legal, scores.source, scores.quality, scores.reliability];
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > PILLAR_MAX)) {
    throw new SupplierError("INVALID_INPUT", `Each pillar score must be a whole number 0–${PILLAR_MAX}.`);
  }
  if (!reason.trim()) throw new SupplierError("REASON_REQUIRED", "A reason is required for every vetting decision.");
  const sum = values.reduce((a, b) => a + b, 0);
  const tier = tierFor(sum);
  const review = nextReviewAt ?? defaultReviewDate(tier);

  return prisma.$transaction(async (tx) => {
    const miner = await tx.miner.findUnique({ where: { id: minerId }, include: { organization: true } });
    if (!miner) throw new SupplierError("MINER_NOT_FOUND");
    const updated = await tx.miner.update({
      where: { id: minerId },
      data: {
        scoreLegal: scores.legal,
        scoreSource: scores.source,
        scoreQuality: scores.quality,
        scoreReliability: scores.reliability,
        tier,
        nextReviewAt: review,
        // A first passing score activates the account; a suspension is never silently lifted.
        ...(tier !== "NOT_ONBOARDED" && miner.organization.status === "PENDING" && { organization: { update: { status: "ACTIVE" } } }),
      },
    });
    const was = total(miner);
    await audit(
      tx, actor, "Supplier vetted", "Miner", miner.reference,
      `${miner.tier}${was != null ? ` · ${was}/100` : ""}`,
      `${tier} · ${sum}/100 (L${scores.legal} S${scores.source} Q${scores.quality} R${scores.reliability}) · review ${review.toISOString().slice(0, 10)}`,
      reason.trim(),
    );
    return updated;
  }, TX_OPTS);
}
