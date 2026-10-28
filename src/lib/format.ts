import type { Prisma } from "@prisma/client";

type Num = Prisma.Decimal | number | string | null | undefined;
const n = (v: Num) => (v == null ? 0 : Number(v));

export const fmtTonnes = (v: Num) => `${n(v).toFixed(1)} t`;
export const fmtGrade = (v: Num, unit = "%") => `${n(v).toFixed(1)}${unit}`;

// Unit prices are stored as ₦ per tonne (millions), e.g. 12_100_000.
export const fmtPricePerT = (v: Num) => `₦ ${(n(v) / 1e6).toFixed(2)} m/t`;

// Money totals in ₦.
export const fmtMoney = (v: Num) => {
  const x = n(v);
  if (x >= 1e9) return `₦ ${(x / 1e9).toFixed(2)} bn`;
  if (x >= 1e6) return `₦ ${(x / 1e6).toFixed(2)} m`;
  return `₦ ${x.toFixed(0)}`;
};

export const batchValue = (available: Num, unitPrice: Num) => n(available) * n(unitPrice);

// ponytail: UTC, no locale/tz. Ops console reads this fine; localize when a
// customer-facing surface needs it.
export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "—";

// Buyer-facing commodity names + their 3D illustration (public/assets/landing).
export const COMMODITY: Record<string, { label: string; short: string; img: string }> = {
  gold: { label: "Gold concentrate", short: "Gold concentrate", img: "/assets/landing/gold.webp" },
  tin: { label: "Cassiterite (tin)", short: "Cassiterite", img: "/assets/landing/cassiterite.webp" },
  coltan: { label: "Columbite–tantalite", short: "Coltan", img: "/assets/landing/coltan.webp" },
  leadzinc: { label: "Lead–zinc concentrate", short: "Lead–zinc", img: "/assets/landing/lead-zinc.webp" },
};
export const commodityLabel = (c: string) => COMMODITY[c]?.label ?? c;
