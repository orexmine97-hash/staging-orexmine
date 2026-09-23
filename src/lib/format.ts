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
