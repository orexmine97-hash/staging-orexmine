"use server";

import type { MinerDocumentState, MinerScale } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth";
import { authorizeFor } from "@/lib/audit";
import { SupplierError, recordMinerDocument, registerMiner, vetMiner } from "@/lib/suppliers";
import type { ActionResult } from "./procurement";

// Auth/RBAC and domain errors are the caller's to see; anything else is a bug.
function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof SupplierError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const date = (v: string) => (v ? new Date(`${v}T00:00:00Z`) : undefined);

// Procurement Officer registers a supplier (FR-01).
export async function registerMinerAction(formData: FormData): Promise<ActionResult<{ reference: string }>> {
  try {
    const actor = await authorizeFor({ action: "miner.register", recordType: "Miner", recordId: "—" }, "PROCUREMENT", "ADMIN");
    const miner = await registerMiner(
      {
        name: str(formData, "name"),
        scale: str(formData, "scale") as MinerScale,
        commodities: formData.getAll("commodities").map(String),
        miningTitleReference: str(formData, "miningTitleReference"),
        rcNumber: str(formData, "rcNumber"),
        siteDescription: str(formData, "siteDescription"),
        siteLatitude: str(formData, "siteLatitude"),
        siteLongitude: str(formData, "siteLongitude"),
        bankAccountRef: str(formData, "bankAccountRef"),
        monthlyCapTonnes: str(formData, "monthlyCapTonnes"),
      },
      actor,
    );
    revalidatePath("/console/suppliers");
    return { ok: true, reference: miner.reference };
  } catch (e) {
    return toFailure(e);
  }
}

// Checklist row update: on file with a reference, or pending/expired/missing with a reason (FR-02).
export async function recordMinerDocumentAction(formData: FormData): Promise<ActionResult<object>> {
  const minerDocumentId = str(formData, "minerDocumentId");
  try {
    const actor = await authorizeFor(
      { action: "miner.document", recordType: "MinerDocument", recordId: minerDocumentId },
      "PROCUREMENT",
      "ADMIN",
    );
    const expires = str(formData, "expiresAt");
    await recordMinerDocument(
      minerDocumentId,
      str(formData, "state") as MinerDocumentState,
      { reference: str(formData, "reference"), expiresAt: expires ? date(expires) : undefined, reason: str(formData, "reason") },
      actor,
    );
    revalidatePath("/console/suppliers");
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

// Score the four pillars; tier and review date follow (FR-03/04/06).
export async function vetMinerAction(formData: FormData): Promise<ActionResult<object>> {
  const minerId = str(formData, "minerId");
  try {
    const actor = await authorizeFor({ action: "miner.vet", recordType: "Miner", recordId: minerId }, "PROCUREMENT", "ADMIN");
    const n = (k: string) => (str(formData, k) === "" ? NaN : Number(str(formData, k)));
    await vetMiner(
      minerId,
      { legal: n("legal"), source: n("source"), quality: n("quality"), reliability: n("reliability") },
      str(formData, "reason"),
      actor,
      date(str(formData, "nextReviewAt")),
    );
    revalidatePath("/console/suppliers");
    revalidatePath("/console/procurement");
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
