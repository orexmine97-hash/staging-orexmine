import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { batchValue, fmtMoney, fmtTonnes } from "@/lib/format";

export const dynamic = "force-dynamic"; // live inventory (FR-85)

export default async function Home() {
  const batches = await prisma.inventoryBatch.findMany({ where: { status: "SELLABLE" } });
  const availT = batches.reduce((a, b) => a + Number(b.availableQuantity), 0);
  const value = batches.reduce((a, b) => a + batchValue(b.availableQuantity, b.unitPrice), 0);
  const commodities = new Set(batches.map((b) => b.commodity)).size;

  const stats = [
    { label: "Sellable available", value: fmtTonnes(availT) },
    { label: "Inventory value", value: fmtMoney(value) },
    { label: "Batches", value: String(batches.filter((b) => Number(b.availableQuantity) > 0).length) },
    { label: "Commodities", value: String(commodities) },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-accent">Osun gold pilot</p>
      <h1 className="mt-3 max-w-2xl font-heading text-4xl font-semibold leading-tight sm:text-5xl">
        Quality-verified mineral inventory, sold under OREXMINE&rsquo;s terms.
      </h1>
      <p className="mt-4 max-w-xl text-muted">
        Every batch on offer has passed independent assay and quality control, and
        traces back to a vetted, licensed supplier. Availability and price are live.
      </p>
      <Link
        href="/catalog"
        className="mt-8 inline-block rounded-md bg-accent px-5 py-3 text-sm font-medium text-white hover:opacity-90"
      >
        Browse the catalog
      </Link>

      <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-divider bg-divider sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface p-5">
            <dt className="text-xs uppercase tracking-wide text-muted">{s.label}</dt>
            <dd className="mt-1 font-heading text-2xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
