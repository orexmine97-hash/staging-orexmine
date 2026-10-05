import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { batchValue, fmtGrade, fmtMoney, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { MineralShowcase } from "../mineral-showcase";

export const dynamic = "force-dynamic"; // live facts from the transactional API (FR-85)

const COMMODITY_LABEL: Record<string, string> = {
  gold: "Gold concentrate",
  tin: "Cassiterite (tin)",
  coltan: "Columbite–tantalite",
  leadzinc: "Lead–zinc concentrate",
};

export default async function BatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.inventoryBatch.findUnique({
    where: { batchNumber: id },
    include: {
      sourceDelivery: {
        include: {
          purchaseOrder: { include: { miner: { include: { organization: true } } } },
          assays: true,
          qcDecisions: { orderBy: { decidedAt: "desc" } },
        },
      },
      sourceVerification: true,
      mineralAsset: true,
    },
  });
  if (!batch || batch.status !== "SELLABLE") notFound();

  const available = Number(batch.availableQuantity);
  const del = batch.sourceDelivery;
  const po = del?.purchaseOrder;
  const miner = po?.miner;
  const assay = del?.assays[0];
  const qc = del?.qcDecisions[0];

  const facts: [string, string][] = [
    ["Grade (assayed)", fmtGrade(batch.grade, batch.gradeUnit)],
    ["Available", fmtTonnes(available)],
    ["Reserved", fmtTonnes(batch.reservedQuantity)],
    ["Price", fmtPricePerT(batch.unitPrice)],
    ["Order value (available)", fmtMoney(batchValue(available, batch.unitPrice))],
    ["Location", batch.location],
  ];

  // batch -> delivery -> PO -> miner, plus assay/QC/source (FR-24).
  const chain: [string, string | undefined][] = [
    ["Vetted supplier", miner ? `${miner.organization.name} · ${miner.reference}` : undefined],
    ["Mining title", miner?.miningTitleReference ?? undefined],
    ["Purchase order", po?.reference],
    ["Delivery", del?.reference],
    ["Independent assay", assay ? `${assay.reference} · ${assay.laboratory ?? "lab on file"}` : undefined],
    ["QC decision", qc ? `${qc.decision} · ${qc.decidedByName}` : undefined],
    ["Source verification", batch.sourceVerification ? batch.sourceVerification.method : undefined],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/catalog" className="text-sm text-muted hover:text-text">← Catalog</Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Presentation aid — only APPROVED assets are shown; live facts sit beside it. */}
        <MineralShowcase
          asset={
            batch.mineralAsset && batch.mineralAsset.approvalStatus === "APPROVED"
              ? { posterUrl: batch.mineralAsset.posterUrl, modelUrl: batch.mineralAsset.modelUrl }
              : null
          }
          label={COMMODITY_LABEL[batch.commodity] ?? batch.commodity}
        />

        <div>
          <h1 className="font-heading text-3xl font-semibold">
            {COMMODITY_LABEL[batch.commodity] ?? batch.commodity}
          </h1>
          <p className="mt-1 text-sm text-muted">{batch.batchNumber}</p>

          <dl className="mt-6 divide-y divide-divider rounded-lg border border-divider bg-surface">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-3 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          <button
            disabled
            title="Reservation runs through the Trade Desk once authentication is wired."
            className="mt-4 w-full cursor-not-allowed rounded-md bg-accent px-5 py-3 text-sm font-medium text-white opacity-50"
          >
            Request quote — via Trade Desk
          </button>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-heading text-xl font-semibold">Traceability</h2>
        <p className="mt-1 text-sm text-muted">
          Every sellable batch traces back to its delivery, purchase order, vetted
          supplier, assay, and quality decision.
        </p>
        <dl className="mt-4 divide-y divide-divider rounded-lg border border-divider bg-surface">
          {chain.map(([k, v]) => (
            <div key={k} className="flex justify-between px-4 py-3 text-sm">
              <dt className="text-muted">{k}</dt>
              <dd className="font-medium">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
