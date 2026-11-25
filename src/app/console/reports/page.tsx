import { fmtMoney, fmtTonnes } from "@/lib/format";
import { cashPosition } from "@/lib/finance";
import { DIMENSIONS, inventoryReport, marginReport, procurementReport, salesReport, type Dimension, type Group, type Report } from "@/lib/reports";

export const dynamic = "force-dynamic";

const card = "mt-3 overflow-x-auto rounded-lg border border-divider bg-surface";
const th = "px-4 py-2 font-medium";
const small = "rounded border border-divider bg-bg px-2 py-1 text-sm";

type Col = { key: string; label: string; fmt: (v: number) => string };
const t = (key: string, label: string): Col => ({ key, label, fmt: fmtTonnes });
const m = (key: string, label: string): Col => ({ key, label, fmt: fmtMoney });
const pct = (num: string, den: string, label: string) => ({ num, den, label });

function Table({ groups, cols, ratio }: { groups: Group[]; cols: Col[]; ratio?: ReturnType<typeof pct> }) {
  const total = (k: string) => groups.reduce((s, g) => s + (g.totals[k] ?? 0), 0);
  const share = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");
  const cells = (get: (k: string) => number) => (
    <>
      {cols.map((c) => (
        <td key={c.key} className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{c.fmt(get(c.key))}</td>
      ))}
      {ratio && <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{share(get(ratio.num), get(ratio.den))}</td>}
    </>
  );
  return (
    <div className={card}>
      <table className="w-full text-sm">
        <thead className="border-b border-divider text-left text-xs text-muted">
          <tr>
            <th className={th}>Group</th>
            <th className={`${th} text-right`}>Records</th>
            {cols.map((c) => <th key={c.key} className={`${th} text-right`}>{c.label}</th>)}
            {ratio && <th className={`${th} text-right`}>{ratio.label}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-divider">
          {groups.map((g) => (
            <tr key={g.key}>
              <td className="px-4 py-2 font-medium">{g.key}</td>
              <td className="px-4 py-2 text-right tabular-nums">{g.count}</td>
              {cells((k) => g.totals[k] ?? 0)}
            </tr>
          ))}
          {groups.length === 0 ? (
            <tr><td colSpan={cols.length + 3} className="px-4 py-6 text-center text-muted">Nothing in this period.</td></tr>
          ) : (
            <tr className="font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{groups.reduce((s, g) => s + g.count, 0)}</td>
              {cells(total)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, note, report, by, children }: { title: string; note: string; report: Report; by: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{note}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Group by
          <select name={report} defaultValue={by} form="report-filters" className={`${small} text-text`}>
            {DIMENSIONS[report].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <div className="rounded-lg border border-divider bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-heading text-lg font-semibold tabular-nums ${tone === "bad" ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// Procurement, sales, inventory, margin and cash exposure (FRD FR-64–68).
export default async function Reports({ searchParams }: PageProps<"/console/reports">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // Untrusted query: unknown dimensions fall back to the first one.
  const dim = <R extends Report>(r: R): Dimension<R> => {
    const opts: readonly string[] = DIMENSIONS[r];
    return (opts.includes(str(r)) ? str(r) : opts[0]) as Dimension<R>;
  };
  const day = (k: string) => {
    const d = new Date(`${str(k)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const now = new Date();
  const from = day("from") ?? new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const toDay = day("to") ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const period = { from, to: new Date(toDay.getTime() + 86_400_000) }; // "to" date is inclusive
  const by = { procurement: dim("procurement"), sales: dim("sales"), inventory: dim("inventory"), margin: dim("margin") };

  const [procurement, sales, inventory, margin, cash] = await Promise.all([
    procurementReport(period, by.procurement),
    salesReport(period, by.sales),
    inventoryReport(by.inventory),
    marginReport(period, by.margin),
    cashPosition(now),
  ]);
  const noCost = margin.reduce((s, g) => s + (g.totals.unknown ?? 0), 0);

  return (
    <div className="flex flex-col gap-10">
      <form id="report-filters" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <input type="date" name="from" defaultValue={ymd(from)} className={`${small} text-text`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          To
          <input type="date" name="to" defaultValue={ymd(toDay)} className={`${small} text-text`} />
        </label>
        <button className="rounded bg-text px-3 py-1.5 text-sm font-medium text-bg">Apply</button>
        <p className="text-xs text-muted">Dates are UTC. Inventory and cash are as of now, not the period.</p>
      </form>

      <section>
        <h2 className="font-heading text-lg font-semibold">Obligations and exposure</h2>
        <p className="mt-1 text-sm text-muted">Open buyer invoices and unpaid miner balances, as of now.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Buyer receivables" value={fmtMoney(cash.receivable)} />
          <Stat label={`Overdue (${cash.overdueInvoices.length} invoice${cash.overdueInvoices.length === 1 ? "" : "s"})`} value={fmtMoney(cash.overdue)} tone={cash.overdue > 0 ? "bad" : undefined} />
          <Stat label={`Owed to miners (${cash.payables.length} PO${cash.payables.length === 1 ? "" : "s"})`} value={fmtMoney(cash.owedMiners)} />
          <Stat label="Net cash exposure" value={fmtMoney(cash.exposure)} />
          <Stat label="Open invoices" value={String(cash.invoices.length)} />
        </div>
      </section>

      <Section title="Procurement" note="QC-accepted deliveries received in the period, at the PO price." report="procurement" by={by.procurement}>
        <Table groups={procurement} cols={[t("tonnes", "Accepted"), m("value", "Value")]} />
      </Section>

      <Section title="Sales" note="Orders confirmed in the period, at the frozen order price." report="sales" by={by.sales}>
        <Table groups={sales} cols={[t("tonnes", "Ordered"), t("delivered", "Delivered"), m("value", "Value")]} />
      </Section>

      <Section title="Margin" note="Expected on ordered tonnes, realized on delivered tonnes, using the cost frozen on each order." report="margin" by={by.margin}>
        <Table
          groups={margin}
          cols={[m("revenue", "Order value"), m("expected", "Expected margin"), m("realizedRevenue", "Delivered value"), m("realized", "Realized margin")]}
          ratio={pct("expected", "costedRevenue", "Expected %")}
        />
        {noCost > 0 && (
          <p className="mt-2 text-xs text-amber">{noCost} order{noCost === 1 ? " has" : "s have"} no recorded cost and {noCost === 1 ? "is" : "are"} excluded from margin.</p>
        )}
      </Section>

      <Section title="Inventory position" note="Every batch not yet depleted, as of now. Value is available tonnes at cost." report="inventory" by={by.inventory}>
        <Table groups={inventory} cols={[t("total", "Total"), t("available", "Available"), t("reserved", "Reserved"), t("held", "Held"), m("value", "Available at cost")]} />
      </Section>
    </div>
  );
}
