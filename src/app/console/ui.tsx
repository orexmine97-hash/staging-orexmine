// Shared status pill for the console tables. Maps any lifecycle enum value to
// one of four tones using the existing theme tokens (+ Tailwind's red for bad).
const TONE: Record<string, string> = {
  good: "bg-accent/10 text-accent",
  warn: "bg-amber/10 text-amber",
  bad: "bg-red-600/10 text-red-700",
  neutral: "bg-divider text-muted",
};

const GOOD = new Set(["SELLABLE", "QC_PASSED", "PASS", "ACTIVE", "VERIFIED", "PAID", "APPROVED", "CONFIRMED", "DELIVERED"]);
const WARN = new Set(["QC_HOLD", "HOLD", "RETEST", "OFFERED", "ACCEPTED", "PENDING", "PENDING_REVIEW", "IN_TRANSIT", "RECEIVED", "PAYABLE", "RESERVED", "PARTIAL", "DELAYED", "DISCREPANCY", "ISSUED", "PART_PAID", "QUOTED", "RENEWAL_DUE"]);
const BAD = new Set(["QC_FAIL", "QC_FAILED", "FAIL", "CANCELLED", "REJECTED", "DECLINED", "EXPIRED", "FAILED", "OVERDUE", "SUSPENDED", "WRITTEN_OFF", "QUARANTINE"]);

function toneFor(s: string) {
  if (GOOD.has(s)) return "good";
  if (BAD.has(s)) return "bad";
  if (WARN.has(s)) return "warn";
  return "neutral";
}

export function Badge({ children }: { children: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONE[toneFor(children)]}`}>
      {children}
    </span>
  );
}
