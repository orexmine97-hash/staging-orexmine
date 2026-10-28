import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COMMODITY, batchValue, commodityLabel, fmtGrade, fmtMoney, fmtPricePerT, fmtTonnes } from "@/lib/format";

export const dynamic = "force-dynamic"; // live inventory (FR-85)

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim();

  // Only QC-passed, sellable batches ever reach the buyer (FR-80).
  const batches = await prisma.inventoryBatch.findMany({
    where: {
      status: "SELLABLE",
      ...(query && {
        OR: [
          { batchNumber: { contains: query, mode: "insensitive" } },
          { commodity: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ commodity: "asc" }, { grade: "desc" }],
  });

  const totalAvail = batches.reduce((a, b) => a + Number(b.availableQuantity), 0);
  const minerals = new Set(batches.map((b) => b.commodity)).size;

  return (
    <main className="mx-auto max-w-[1280px] px-[clamp(16px,3vw,40px)] pb-24 pt-10">
      <section aria-labelledby="inv-title" className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
          <span className="inline-flex items-center gap-2 font-heading text-[13px] font-semibold uppercase tracking-[0.14em] text-amber">
            <ShieldCheck size={16} aria-hidden="true" />
            Live from the batch register
          </span>
          <h1 id="inv-title" className="m-0 font-heading text-[clamp(32px,4vw,48px)] font-semibold leading-[1.05] tracking-[-0.03em]">
            Inventory
          </h1>
          <p className="m-0 max-w-[56ch] text-muted">
            Only QC-passed, sellable stock is listed. Batches on QC hold or that failed assay are never shown.
          </p>
        </div>
        <dl className="m-0 flex overflow-hidden rounded-2xl bg-surface">
          {[
            ["Sellable", fmtTonnes(totalAvail)],
            ["Batches", String(batches.length)],
            ["Minerals", String(minerals)],
          ].map(([k, v]) => (
            <div key={k} className="border-r border-divider px-[22px] py-3.5 last:border-r-0">
              <dt className="text-[13px] text-muted">{k}</dt>
              <dd className="m-0 font-heading text-xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-[18px] mt-10 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="m-0 font-heading text-[17px] font-semibold">
          {batches.length} sellable {batches.length === 1 ? "batch" : "batches"}
          {query && (
            <>
              {" "}matching &ldquo;{query}&rdquo;{" "}
              <Link href="/catalog" className="text-sm font-bold text-accent hover:underline">Clear</Link>
            </>
          )}
        </p>
        {/* Mineral chips → the same server-side ?q= filter as the header search. */}
        <nav aria-label="Mineral" className="flex flex-wrap gap-2">
          {[["All", ""], ...Object.entries(COMMODITY).map(([k, c]) => [c.short, k])].map(([label, key]) => {
            const on = query === key;
            return (
              <Link
                key={label}
                href={key ? `/catalog?q=${key}` : "/catalog"}
                aria-current={on ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${
                  on ? "border-ink bg-ink text-[#f4f6f2]" : "border-divider bg-surface hover:border-ink/40"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {batches.length === 0 && (
        <p className="rounded-3xl bg-surface p-10 text-center text-sm text-muted">
          No sellable batches{query ? <> match &ldquo;{query}&rdquo;</> : ""}.
        </p>
      )}

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(264px,100%),1fr))] gap-4 p-0">
        {batches.map((b) => {
          const available = Number(b.availableQuantity);
          const quantity = Number(b.quantity);
          const pct = quantity > 0 ? Math.round((available / quantity) * 100) : 0;
          const href = `/catalog/${b.batchNumber}`;
          return (
            <li key={b.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-3xl bg-surface">
                <Link
                  href={href}
                  className="relative block aspect-[4/3] overflow-hidden"
                  style={{ background: "radial-gradient(100% 80% at 50% 35%, #fbfaf6 0%, #e4e8e2 78%)" }}
                >
                  {COMMODITY[b.commodity] && (
                    // eslint-disable-next-line @next/next/no-img-element -- static illustration
                    <img
                      src={COMMODITY[b.commodity].img}
                      alt={`Illustration of ${commodityLabel(b.commodity).toLowerCase()}`}
                      className="absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2"
                    />
                  )}
                  {pct <= 25 && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[13px] font-bold">
                      <span aria-hidden="true" className="size-[7px] rounded-full bg-accent" />
                      Low stock
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 rounded-full bg-[#d9e6de] px-2.5 py-0.5 text-[13px] font-bold text-[#245a4a]">
                    QC passed
                  </span>
                </Link>
                <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-[18px]">
                  <div>
                    <h2 className="m-0 font-heading text-lg font-semibold tracking-[-0.01em]">{commodityLabel(b.commodity)}</h2>
                    <p className="m-0 mt-0.5 text-[13px] tabular-nums text-muted">{b.batchNumber} · {b.location}</p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1 whitespace-nowrap">
                      <span className="font-heading text-[30px] font-semibold leading-none tabular-nums tracking-[-0.02em]">{fmtGrade(b.grade, "")}</span>
                      <span className="text-[15px] font-semibold text-muted">{b.gradeUnit}</span>
                    </div>
                    <p className="m-0 mt-1 text-[13px] text-muted">Assayed grade</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-sm tabular-nums">
                      <span><b className="font-bold">{fmtTonnes(available)}</b> available</span>
                      <span className="text-muted">of {fmtTonnes(quantity)}</span>
                    </div>
                    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-divider pt-3.5">
                    <div>
                      <div className="text-[13px] text-muted">Indicative ask</div>
                      <div className="text-[15px] font-bold">{fmtPricePerT(b.unitPrice)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] text-muted">Lot value</div>
                      <div className="text-[15px] font-bold">{fmtMoney(batchValue(available, b.unitPrice))}</div>
                    </div>
                  </div>
                  <Link
                    href={href}
                    className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-ink text-sm font-bold text-[#f4f6f2] hover:opacity-90"
                  >
                    View batch
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
