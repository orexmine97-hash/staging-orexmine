import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { batchValue, fmtGrade, fmtMoney, fmtPricePerT, fmtTonnes } from "@/lib/format";

export const dynamic = "force-dynamic"; // live inventory (FR-85)

const COMMODITY_LABEL: Record<string, string> = {
  gold: "Gold concentrate",
  tin: "Cassiterite (tin)",
  coltan: "Columbite–tantalite",
  leadzinc: "Lead–zinc concentrate",
};

function stockLabel(available: number, quantity: number) {
  const r = quantity > 0 ? available / quantity : 0;
  if (r > 0.6) return { text: "In stock", cls: "text-accent" };
  if (r > 0.25) return { text: "Limited", cls: "text-amber" };
  return { text: "Low stock", cls: "text-amber" };
}

export default async function CatalogPage() {
  // Only QC-passed, sellable batches ever reach the buyer (FR-80).
  const batches = await prisma.inventoryBatch.findMany({
    where: { status: "SELLABLE" },
    orderBy: [{ commodity: "asc" }, { grade: "desc" }],
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold">Catalog</h1>
      <p className="mt-1 text-sm text-muted">
        {batches.length} sellable {batches.length === 1 ? "batch" : "batches"} ·{" "}
        {fmtTonnes(batches.reduce((a, b) => a + Number(b.availableQuantity), 0))} available
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {batches.map((b) => {
          const available = Number(b.availableQuantity);
          const stock = stockLabel(available, Number(b.quantity));
          return (
            <li key={b.id}>
              <Link
                href={`/catalog/${b.batchNumber}`}
                className="block rounded-lg border border-divider bg-surface p-5 transition hover:border-accent"
              >
                <div className="flex items-start justify-between">
                  <span className="font-heading text-lg font-semibold">
                    {COMMODITY_LABEL[b.commodity] ?? b.commodity}
                  </span>
                  <span className={`text-xs font-medium ${stock.cls}`}>{stock.text}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{b.batchNumber}</p>

                <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-muted">Grade</dt>
                  <dd className="text-right font-medium">{fmtGrade(b.grade, b.gradeUnit)}</dd>
                  <dt className="text-muted">Available</dt>
                  <dd className="text-right font-medium">{fmtTonnes(available)}</dd>
                  <dt className="text-muted">Price</dt>
                  <dd className="text-right font-medium">{fmtPricePerT(b.unitPrice)}</dd>
                  <dt className="text-muted">Value</dt>
                  <dd className="text-right font-medium">{fmtMoney(batchValue(available, b.unitPrice))}</dd>
                </dl>
                <p className="mt-4 text-xs text-muted">{b.location}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
