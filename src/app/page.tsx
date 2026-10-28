import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronRight, FlaskConical, MapPin, ShieldCheck, Truck, Warehouse } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COMMODITY, fmtGrade, fmtTonnes } from "@/lib/format";

export const dynamic = "force-dynamic"; // live inventory (FR-85)

const wrap = "mx-auto max-w-[1280px] px-[clamp(16px,3vw,40px)]";
const section = `${wrap} py-[clamp(72px,9vw,108px)]`;
const h2 = "m-0 font-heading text-[clamp(32px,4.2vw,56px)] font-semibold leading-[1.04] tracking-[-0.035em] text-balance";
const glass =
  "border border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.24),rgba(255,255,255,0.08))] backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_16px_36px_-16px_rgba(0,0,0,0.6)]";
const mock =
  "border border-white/95 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.66))] backdrop-blur-lg shadow-[inset_0_1px_0_#fff,0_24px_48px_-26px_rgba(15,26,23,0.45)]";

function Eyebrow({ children, className = "text-amber" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-heading text-[13px] font-semibold uppercase tracking-[0.14em] ${className}`}>{children}</div>
  );
}

function Btn({ href, children, ghost }: { href: string; children: ReactNode; ghost?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-12 items-center gap-2.5 whitespace-nowrap rounded-xl px-6 text-[15px] font-bold ${
        ghost ? "border border-divider bg-surface text-ink" : "bg-accent text-[#fbfcfa] hover:opacity-90"
      }`}
    >
      {children} <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

function Ticks({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px]">
      {items.map((t) => (
        <li key={t} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Check size={14} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = [
  ["01 · From the miner", "Deliver and declare", "A vetted miner delivers a parcel and declares its origin, tonnage and expected grade."],
  ["02 · On receipt", "Assay and buy", "Weighed and independently assayed. We buy the parcel outright at a settled price on its verified weight and grade."],
  ["03 · Bonded warehouse", "Store", "Passed parcels become a numbered batch. Failed parcels are never sold."],
  ["04 · To the buyer", "Resell", "QC-passed batches only, to approved buyers, with one compliance file each."],
];

const VERIFY = [
  ["QC approved", "Independent assay on every parcel, checked against the declared grade."],
  ["Source verified", "Supplier, mining title and site checked against cadastral records before we buy."],
  ["Traceable", "Every batch and order traces back to the deliveries it came from."],
];

const MINERALS = [
  ["gold", "Au", "Gravity concentrate · Au"],
  ["tin", "Sn", "Tin ore · SnO₂"],
  ["coltan", "Ta", "Coltan · Ta₂O₅"],
  ["leadzinc", "Pb·Zn", "Galena · sphalerite"],
] as const;

const PILLARS = [
  ["Legal standing", "Title, CAC, tax and community agreement."],
  ["Source verification", "Site checked against cadastral records."],
  ["Quality & quantity", "Delivered matches declared."],
  ["Reliability", "On time, every time."],
];

const TIERS = [
  ["Preferred", "bg-ink", "Full documents and a steady grade record. Paid in full within 2 working days of QC, with first call on new volume."],
  ["Conditional", "bg-muted", "Onboarded with conditions, such as tighter assay tolerances or documents still to come. Part paid on delivery, the balance after QC."],
  ["Probationary", "bg-[#9aa59f]", "Under review after a flagged parcel. We keep buying, with closer checks on every delivery."],
  ["Not onboarded", "bg-[#c3ccc6]", "No vetting file yet. We don’t buy from an unvetted source, whatever the parcel’s quality."],
];

const ROUTE: [string, ReactNode, string[]][] = [
  ["Sourcing", <MapPin key="i" size={14} />, ["Osun State", "Kogi State", "Plateau State"]],
  ["Bonded storage", <Warehouse key="i" size={14} />, ["Lagos Free Zone", "Ilesha depot", "Jos depot"]],
];

const COMPLIANCE = [
  ["Counterparty model", "Buy-and-resell"],
  ["Title transfer", "At purchase"],
  ["Beneficiation", "In-country, before export"],
  ["Export documents", "Assay certificate, invoice, waybill"],
  ["Compliance record", "One file per parcel"],
  ["Miner onboarding", "4-pillar vetting score"],
];

export default async function Home() {
  // Ticker shows live QC-passed stock only (FR-80).
  const batches = await prisma.inventoryBatch.findMany({
    where: { status: "SELLABLE", availableQuantity: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const tickerList = (hidden?: boolean) => (
    <ul aria-hidden={hidden || undefined} className="m-0 flex flex-none list-none p-0">
      {batches.map((b) => (
        <li
          key={b.id}
          className="flex min-h-[52px] flex-none items-center gap-2.5 whitespace-nowrap border-r border-white/10 px-6 text-sm tabular-nums sm:min-h-[60px]"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full bg-qc" />
          <span className="font-heading text-[13px] font-semibold uppercase tracking-[0.08em]">
            {COMMODITY[b.commodity]?.short ?? b.commodity}
          </span>
          <span className="text-[#a9b8b1]">{b.batchNumber}</span>
          <span className="font-bold">{fmtGrade(b.grade, b.gradeUnit)}</span>
          <span className="text-[#a9b8b1]">{fmtTonnes(b.availableQuantity)}</span>
          <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#a8ead5]">QC passed</span>
        </li>
      ))}
    </ul>
  );

  return (
    <main className="overflow-x-hidden leading-relaxed">
      {/* HERO */}
      <section id="top" className="relative -mt-[76px] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-[20%] right-[-10%] h-[90%] w-[70%]"
          style={{ background: "radial-gradient(closest-side, rgba(227,154,106,0.10), rgba(227,154,106,0))" }}
        />
        <div className={`${wrap} relative pb-10 pt-[clamp(124px,calc(14vw-40px),156px)]`}>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(500px,100%),1fr))] items-center gap-x-14 gap-y-10">
            <div className="flex flex-col gap-[26px]">
              <Eyebrow>Controlled B2B mineral trade · Nigeria</Eyebrow>
              <h1 className="m-0 font-heading text-[clamp(40px,5.2vw,72px)] font-semibold leading-[1.04] tracking-[-0.035em] text-balance">
                We buy from vetted miners, <span className="text-accent">verify it,</span> then sell it to you.
              </h1>
              <p className="m-0 max-w-[52ch] text-[17px] leading-[1.7] text-[#46534d] text-pretty">
                OREXMINE buys every parcel outright, and nothing reaches a buyer until it has passed an
                independent assay. No marketplace listings, no consignment risk.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="#buyers"
                  className="inline-flex min-h-14 flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl bg-accent px-6 text-[15px] font-bold text-[#fbfcfa] shadow-[0_14px_30px_-16px_rgba(162,88,42,0.9)] sm:flex-none"
                >
                  I&rsquo;m buying minerals <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="#suppliers"
                  className="inline-flex min-h-14 flex-1 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border border-[#cfd8d0] bg-white px-6 text-[15px] font-bold sm:flex-none"
                >
                  I&rsquo;m supplying minerals <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <figure className="relative m-0 aspect-[16/10] max-h-[640px] overflow-hidden rounded-[32px] bg-[#22201e] xl:aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
              <img
                src="/assets/landing/hero-mine.jpg"
                alt="3D illustration of a terraced open-pit mine in savanna"
                className="absolute inset-0 size-full object-cover object-[75%_45%]"
              />
              {[
                { cls: "left-1/2 top-[7%] -translate-x-1/2", icon: <ShieldCheck size={16} />, text: "Source verified", line: "h-14" },
                { cls: "left-[8%] top-[54%]", icon: <FlaskConical size={16} />, text: "Weighed & assayed on receipt", line: "h-11" },
              ].map((p) => (
                <div key={p.text} aria-hidden="true" className={`absolute flex flex-col items-center ${p.cls}`}>
                  <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold text-[#f6f8f5] ${glass}`}>
                    {p.icon}
                    {p.text}
                  </span>
                  <span className={`w-0 border-l-[1.5px] border-dashed border-white/60 ${p.line}`} />
                  <span className="size-2.5 rounded-full bg-[#f6f8f5] shadow-[0_0_0_6px_rgba(255,255,255,0.2)]" />
                </div>
              ))}
              <figcaption className="absolute bottom-3.5 left-4 rounded-full bg-[rgba(11,20,18,0.55)] px-2.5 py-1 text-[13px] text-[#dfe7e2]">
                3D illustration, not an actual OREXMINE site
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* STOCK TICKER — live sellable batches, loops continuously */}
      {batches.length > 0 && (
        <section aria-label="Batches in stock now" className="ox-ticker relative border-y border-white/10 bg-ink text-[#eef2ee]">
          <div className="flex items-stretch">
            <p className="m-0 hidden flex-none items-center gap-2.5 whitespace-nowrap border-r border-white/10 pl-[clamp(16px,3vw,40px)] pr-5 font-heading text-[13px] font-semibold uppercase tracking-[0.12em] text-[#f2b98f] sm:flex">
              <span aria-hidden="true" className="size-2 rounded-full bg-qc shadow-[0_0_0_4px_rgba(127,212,186,0.18)]" />
              In stock now
            </p>
            <div
              className="ox-ticker-view min-w-0 flex-1 overflow-hidden"
              style={{ maskImage: "linear-gradient(90deg, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%)" }}
            >
              <div className="ox-ticker-track flex w-max">
                {tickerList()}
                {tickerList(true)}
              </div>
            </div>
            <div className="flex flex-none items-center border-l border-white/10 py-1.5 pl-3 pr-[clamp(16px,3vw,40px)]">
              <Link
                href="/catalog"
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-[#e39a6a] px-3.5 text-sm font-bold text-[#1a0e06]"
              >
                <span className="hidden sm:inline">See inventory</span>
                <ArrowRight size={16} aria-label="See inventory" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section id="how" className="bg-soft">
        <div className={section}>
          <figure className="relative m-0 mb-5 h-[clamp(220px,26vw,360px)] overflow-hidden rounded-[32px] bg-[#101416]">
            {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
            <img
              src="/assets/landing/warehouse.jpg"
              alt="Rows of OREXMINE bulk bags in a bonded warehouse"
              className="absolute inset-0 size-full object-cover object-[50%_72%]"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-[#ecd5c1] mix-blend-multiply" />
            <figcaption className="absolute bottom-4 left-[18px] inline-flex items-center gap-2 rounded-xl border border-white/20 bg-[rgba(11,20,18,0.62)] px-3.5 py-2 text-[13px] font-semibold text-[#f6f8f5] backdrop-blur-md">
              <Warehouse size={16} aria-hidden="true" />
              Bonded storage · every batch numbered
            </figcaption>
          </figure>

          <div className="rounded-[32px] bg-surface p-[clamp(26px,4.5vw,60px)]">
            <Eyebrow className="text-muted">How OREXMINE trades</Eyebrow>
            <h2 className={`${h2} mb-10 mt-7`}>Two trades. One accountable counterparty.</h2>
            <ol className="m-0 grid list-none gap-3.5 p-0 lg:grid-cols-4">
              {STEPS.map(([num, title, body], i) => (
                <li
                  key={num}
                  className={`flex flex-col gap-3 rounded-2xl p-[26px] lg:min-h-[150px] ${i === 3 ? "bg-accent-soft" : "bg-bg"}`}
                >
                  <span className="font-heading text-[13px] font-semibold uppercase tracking-[0.12em] text-amber">{num}</span>
                  <span className="font-heading text-[26px] font-semibold tracking-[-0.02em]">{title}</span>
                  <span className="text-sm text-[#46534d]">{body}</span>
                </li>
              ))}
            </ol>
            <ul aria-label="What we verify before sale" className="m-0 mt-7 grid list-none gap-x-8 gap-y-[18px] border-t border-ink/15 p-0 pt-6 lg:grid-cols-3">
              {VERIFY.map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <BadgeCheck size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                  <span>
                    <span className="block font-heading font-semibold">{title}</span>
                    <span className="block text-sm text-[#46534d]">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* TWO PATHS */}
      <section id="start">
        <div className={section}>
          <div className="mb-11 flex max-w-[760px] flex-col gap-4">
            <Eyebrow>Two ways in</Eyebrow>
            <h2 className={h2}>Start on whichever side of the trade you&rsquo;re on.</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] gap-5">
            <article id="buyers" className="flex scroll-mt-6 flex-col overflow-hidden rounded-3xl bg-surface">
              <div
                aria-hidden="true"
                className="relative h-[300px] overflow-hidden"
                style={{ background: "radial-gradient(120% 90% at 30% 45%, #fbf7f1 0%, #e1e6df 78%)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
                <img src="/assets/landing/cassiterite.webp" alt="" className="absolute -left-[4%] top-[10%] w-[72%]" />
                <div className={`absolute right-[22px] top-1/2 flex w-[min(270px,62%)] -translate-y-1/2 flex-col gap-3 rounded-2xl p-[18px] ${mock}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-[15px] font-semibold">Cassiterite (tin)</span>
                    <span className="whitespace-nowrap rounded-full bg-[#d9e6de] px-2 py-0.5 text-[13px] font-bold text-[#245a4a]">QC passed</span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[13px] text-muted">
                    {[["Assayed grade", "On certificate"], ["Held at", "Bonded store"], ["Price shown in", "₦ NGN"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold text-ink">{v}</span></div>
                    ))}
                  </div>
                  <span className="border-t border-white pt-2.5 text-[13px] text-muted">A confirmed quote reserves the stock</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-5 p-[clamp(24px,3.4vw,40px)]">
                <Eyebrow>For buyers</Eyebrow>
                <h3 className="m-0 font-heading text-[clamp(24px,2.4vw,32px)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance">
                  Source from stock that has already passed QC.
                </h3>
                <Ticks
                  items={[
                    "QC-passed batches with grade, quantity and location.",
                    "Prices in naira once you sign in. Request a quote on any batch.",
                    "Assay certificate and export documents with every order.",
                  ]}
                />
                <p className="m-0 border-t border-divider pt-4 text-[13px] text-muted">
                  Approved after KYC: business registration, end-use and licences.
                </p>
                <div className="mt-auto"><Btn href="/auth/login">Apply as a buyer</Btn></div>
              </div>
            </article>

            <article id="suppliers" className="flex scroll-mt-6 flex-col overflow-hidden rounded-3xl bg-surface">
              <div
                aria-hidden="true"
                className="relative h-[300px] overflow-hidden"
                style={{ background: "radial-gradient(120% 90% at 70% 45%, #fbf6ea 0%, #e4e2d8 78%)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
                <img src="/assets/landing/gold.webp" alt="" className="absolute -right-[6%] top-[14%] w-[70%]" />
                <div className="absolute left-[22px] top-10 flex w-[min(310px,74%)] flex-col gap-2.5">
                  {[
                    { icon: <Truck size={16} className="text-muted" />, bg: "bg-bg", t: "Delivery received", d: "Weight verified at the weighbridge. Sample sent for assay." },
                    { icon: <Check size={16} className="text-[#245a4a]" />, bg: "bg-[#d9e6de]", t: "QC passed, payout scheduled", d: "Paid within 2 working days." },
                  ].map((n, i) => (
                    <div key={n.t} className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${mock} ${i ? "ml-[22px]" : ""}`}>
                      <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${n.bg}`}>{n.icon}</span>
                      <span className="flex flex-col gap-0.5 text-[13px]">
                        <span className="font-bold">{n.t}</span>
                        <span className="text-muted">{n.d}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-5 p-[clamp(24px,3.4vw,40px)]">
                <Eyebrow>For miners &amp; suppliers</Eyebrow>
                <h3 className="m-0 font-heading text-[clamp(24px,2.4vw,32px)] font-semibold leading-[1.12] tracking-[-0.025em] text-balance">
                  Sell your parcel directly. Get paid within 2 working days of QC.
                </h3>
                <Ticks
                  items={[
                    "A settled price: no bidding, no waiting for a resale.",
                    "Fair weight and grade checks on every delivery.",
                    "Offer, QC and payout updates by SMS or WhatsApp.",
                  ]}
                />
                <p className="m-0 border-t border-divider pt-4 text-[13px] text-muted">
                  A field agent can register you and upload your documents.
                </p>
                {/* Placeholder until supplier onboarding ships. */}
                <div className="mt-auto"><Btn href="#suppliers">Register as a supplier</Btn></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* MINERALS */}
      <section id="minerals">
        <div className={`${section} pt-0`}>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div className="flex flex-col gap-4">
              <Eyebrow>Minerals</Eyebrow>
              <h2 className={h2}>What we trade.</h2>
            </div>
            <Btn href="/catalog" ghost>See what&rsquo;s in stock</Btn>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {MINERALS.map(([key, chip, sub]) => (
              <Link
                key={key}
                href={`/catalog?q=${key}`}
                className="relative flex min-h-[250px] flex-col justify-end overflow-hidden rounded-3xl lg:min-h-[380px]"
                style={{ background: "radial-gradient(100% 80% at 50% 35%, #fbfaf6 0%, #e4e8e2 78%)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
                <img
                  src={COMMODITY[key].img}
                  alt={`3D illustration of ${COMMODITY[key].label.toLowerCase()}`}
                  className="absolute left-1/2 top-[34%] w-[74%] -translate-x-1/2 -translate-y-1/2 lg:top-[42%] lg:w-[92%]"
                />
                <span className="absolute left-4 top-4 grid h-[42px] min-w-[42px] place-items-center rounded-xl border border-divider bg-[rgba(251,252,250,0.85)] px-2.5 font-heading text-[15px] font-bold">
                  {chip}
                </span>
                <div
                  className="relative flex flex-col gap-0.5 px-5 py-[18px]"
                  style={{ background: "linear-gradient(180deg, rgba(251,252,250,0) 0%, rgba(251,252,250,0.88) 55%)" }}
                >
                  <span className="font-heading text-base font-semibold leading-tight tracking-[-0.015em] lg:text-[19px]">
                    {COMMODITY[key].label}
                  </span>
                  <span className="text-[13px] text-muted">{sub}</span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mb-0 mt-[18px] text-[13px] text-muted">3D illustrations, not batch photos.</p>
        </div>
      </section>

      {/* VETTING */}
      <section className="border-t border-divider bg-soft">
        <div className={section}>
          <div className="mb-11 grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-end gap-x-14 gap-y-5">
            <div className="flex flex-col gap-4">
              <Eyebrow>Supplier vetting</Eyebrow>
              <h2 className={h2}>Every supplier earns their standing.</h2>
            </div>
            <p className="m-0 max-w-[52ch] text-muted text-pretty">
              Scored before we buy and re-checked with every parcel. The tier decides how our buying desk deals
              with a miner, from priority settlement to no purchase at all.
            </p>
          </div>
          <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(250px,100%),1fr))] gap-3.5">
            {PILLARS.map(([title, body], i) => (
              <div key={title} className="flex flex-col gap-2.5 rounded-3xl bg-surface p-6 lg:min-h-[128px]">
                <span className="font-heading text-[13px] font-semibold tracking-[0.16em] text-amber">PILLAR 0{i + 1}</span>
                <span className="font-heading text-[19px] font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-surface p-[clamp(22px,3vw,34px)]">
            <Eyebrow className="mb-[18px] text-muted">Supplier standing</Eyebrow>
            <div role="list" aria-label="Supplier tiers" className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-x-6 gap-y-[18px]">
              {TIERS.map(([name, bar, body]) => (
                <div key={name} role="listitem" className="flex flex-col gap-2">
                  <span className={`h-1.5 rounded-lg ${bar}`} />
                  <span className="font-heading font-semibold">{name}</span>
                  <span className="text-[13px] text-muted">{body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHERE WE OPERATE */}
      <section
        className="border-t border-divider bg-soft"
        style={{ backgroundImage: "radial-gradient(rgba(15,26,23,0.09) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      >
        <div className={`${section} grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-center gap-x-[72px] gap-y-12`}>
          <div className="flex flex-col gap-[18px]">
            <Eyebrow>Where we operate</Eyebrow>
            <h2 className={h2}>Sourced from three states, held in three depots.</h2>
            <p className="m-0 max-w-[52ch] text-muted text-pretty">
              Buyers see grade, quantity and location. Supplier identity and purchase cost stay inside OREXMINE.
            </p>
          </div>
          <div aria-label="Supply route" className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
            {ROUTE.map(([label, icon, places]) => (
              <div key={label} className="contents">
                <div className="flex flex-1 basis-0 flex-col gap-2.5">
                  <span className="flex h-5 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                    {icon}
                    {label}
                  </span>
                  {places.map((p) => (
                    <span key={p} className="rounded-xl border border-divider bg-surface px-3.5 py-3 text-sm font-semibold">{p}</span>
                  ))}
                </div>
                <ChevronRight aria-hidden="true" className="shrink-0 rotate-90 self-center text-accent lg:mt-[42px] lg:rotate-0 lg:self-start" />
              </div>
            ))}
            <div className="flex flex-1 basis-0 flex-col gap-2.5">
              <span className="flex h-5 items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                <BadgeCheck size={14} />
                Sold to
              </span>
              <span className="rounded-xl bg-accent px-3.5 py-3 text-sm font-bold text-[#fbfcfa]">Approved buyers</span>
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE */}
      <section id="compliance" className="border-t border-divider">
        <div className={`${section} grid grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-start gap-x-[72px] gap-y-10`}>
          <div className="flex flex-col gap-[18px]">
            <Eyebrow>In-country value &amp; compliance</Eyebrow>
            <h2 className={h2}>Beneficiation stays home.</h2>
            <p className="m-0 max-w-[52ch] text-muted text-pretty">
              Where the law requires in-country beneficiation, it happens before export and is part of how we
              price the purchase. Every parcel has one compliance file, and OREXMINE is the counterparty of record.
            </p>
          </div>
          <dl className="m-0 rounded-3xl bg-surface px-[26px] py-2 text-sm">
            {COMPLIANCE.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-divider py-[17px] last:border-b-0">
                <dt className="text-muted">{k}</dt>
                <dd className="m-0 text-right font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="px-4 pb-[72px] sm:px-[clamp(16px,3vw,40px)] lg:pb-32">
        <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-[32px] bg-[#0b1412] text-[#f6f8f5]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static decorative render */}
          <img src="/assets/landing/hero-mine.jpg" alt="" className="absolute inset-0 size-full scale-[1.08] object-cover object-[30%_70%]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[rgba(8,14,12,0.5)]" />
          <div className="relative px-4 py-14 lg:px-[clamp(16px,3vw,40px)] lg:py-[clamp(80px,10vw,120px)]">
            <div className="mx-auto flex max-w-[860px] flex-col items-center gap-[22px] rounded-[32px] border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] p-[clamp(32px,5vw,64px)] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_40px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              <h2 className={h2}>
                Approved buyers only. <span className="text-[#f2b98f]">Every tonne accounted for.</span>
              </h2>
              <p className="m-0 max-w-[50ch] text-[#d4ded9]">
                Buyers reserve stock by batch. Suppliers are paid within 2 working days of QC.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/auth/login"
                  className="inline-flex min-h-14 items-center gap-2.5 whitespace-nowrap rounded-xl bg-[#e39a6a] px-6 text-[15px] font-bold text-[#1a0e06]"
                >
                  Apply as a buyer <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="#suppliers"
                  className="inline-flex min-h-14 items-center gap-2.5 whitespace-nowrap rounded-xl border border-white/30 bg-white/[0.08] px-6 text-[15px] font-bold text-[#f6f8f5]"
                >
                  Register as a supplier <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
