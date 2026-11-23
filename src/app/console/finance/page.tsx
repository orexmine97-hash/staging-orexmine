import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { isOverdue } from "@/lib/finance";
import { closeSalesOrderAction, issueInvoiceAction, recordBuyerPaymentAction, recordMinerPayoutAction } from "@/app/actions/finance";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";

export const dynamic = "force-dynamic";

const card = "mt-3 overflow-x-auto rounded-lg border border-divider bg-surface";
const th = "px-4 py-2 font-medium";
const small = "rounded border border-divider bg-bg px-2 py-1 text-xs";
const buyerName = { buyer: { include: { organization: { select: { name: true } } } } } as const;

// Amount, method and accounting reference — shared by receipts and payouts (FR-52).
function PaymentFields({ max }: { max: number }) {
  return (
    <>
      <input name="amount" type="number" min="0.01" step="0.01" max={max} defaultValue={max} required className={`${small} w-28`} />
      <input name="method" placeholder="Method" defaultValue="Bank transfer" className={`${small} w-28`} />
      <input name="externalRef" placeholder="Bank / GL ref" className={`${small} w-28`} />
      <input name="paidAt" type="date" className={small} />
    </>
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

// Receivables, miner obligations and close-out (FR-48/50/51/68).
export default async function Finance() {
  const now = new Date();
  const [delivered, invoices, pos, paid] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { deliveredQuantity: { gt: 0 }, status: { notIn: ["CANCELLED", "CLOSED"] } },
      orderBy: { confirmedAt: "asc" },
      include: buyerName,
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PART_PAID"] } },
      orderBy: { dueAt: "asc" },
      include: { salesOrder: { include: buyerName } },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["QC_PASSED", "PAYABLE"] } },
      orderBy: { updatedAt: "asc" },
      include: { miner: { include: { organization: { select: { name: true } } } }, deliveries: { where: { status: "VERIFIED" } }, payouts: true },
    }),
    prisma.salesOrder.findMany({ where: { status: "PAID" }, include: buyerName }),
  ]);

  const toInvoice = delivered.filter((so) => so.deliveredQuantity.gt(so.invoicedQuantity));
  const outstanding = (i: (typeof invoices)[number]) => Number(i.amount) - Number(i.amountPaid);
  const receivable = invoices.reduce((s, i) => s + outstanding(i), 0);
  const overdue = invoices.filter((i) => isOverdue(i, now)).reduce((s, i) => s + outstanding(i), 0);
  // Same rule as minerBalance(): verified tonnes × PO price, less payouts.
  const payables = pos
    .map((po) => {
      const owed = po.deliveries.reduce((s, d) => s + Number(d.verifiedQuantity ?? 0), 0) * Number(po.unitPrice);
      const out = owed - po.payouts.reduce((s, p) => s + Number(p.amount), 0);
      return { po, owed, out };
    })
    .filter((p) => p.out > 0.005);
  const owedMiners = payables.reduce((s, p) => s + p.out, 0);

  return (
    <div className="flex flex-col gap-10">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Buyer receivables" value={fmtMoney(receivable)} />
        <Stat label="Overdue" value={fmtMoney(overdue)} tone={overdue > 0 ? "bad" : undefined} />
        <Stat label="Owed to miners" value={fmtMoney(owedMiners)} />
        <Stat label="Net cash exposure" value={fmtMoney(receivable - owedMiners)} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Ready to invoice</h2>
        <p className="mt-1 text-sm text-muted">Delivered tonnes not yet billed, at the order&rsquo;s frozen price.</p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Buyer</th>
                <th className={`${th} text-right`}>Delivered</th>
                <th className={`${th} text-right`}>Invoiced</th>
                <th className={`${th} text-right`}>To bill</th>
                <th className={th}>Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {toInvoice.map((so) => {
                const qty = so.deliveredQuantity.sub(so.invoicedQuantity);
                return (
                  <tr key={so.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2">
                      <div className="font-medium">{so.reference}</div>
                      <Badge>{so.status}</Badge>
                    </td>
                    <td className="px-4 py-2">{so.buyer.organization.name}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.deliveredQuantity)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.invoicedQuantity)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <div className="tabular-nums">{fmtMoney(qty.mul(so.unitPrice))}</div>
                      <div className="text-xs text-muted">{fmtTonnes(qty)} @ {fmtPricePerT(so.unitPrice)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <ActionForm action={issueInvoiceAction} success="Invoice issued:">
                        <input type="hidden" name="soId" value={so.id} />
                        <label className="flex items-center gap-1 text-xs text-muted">
                          due in
                          <input name="dueDays" type="number" min="1" max="180" defaultValue={30} className={`${small} w-14 text-text`} />
                          days
                        </label>
                        <input name="externalRef" placeholder="Accounting ref" className={`${small} w-28`} />
                        <Submit>Issue invoice</Submit>
                      </ActionForm>
                    </td>
                  </tr>
                );
              })}
              {toInvoice.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Nothing delivered and unbilled.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Open invoices</h2>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Invoice</th>
                <th className={th}>Order · buyer</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={`${th} text-right`}>Outstanding</th>
                <th className={th}>Due</th>
                <th className={th}>Record receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {invoices.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{i.reference}</div>
                    <Badge>{isOverdue(i, now) ? "OVERDUE" : i.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div>{i.salesOrder.reference}</div>
                    <div className="text-xs text-muted">{i.salesOrder.buyer.organization.name}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtMoney(i.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtMoney(outstanding(i))}</td>
                  <td className="whitespace-nowrap px-4 py-2">{i.dueAt ? fmtDate(i.dueAt).slice(0, 10) : "—"}</td>
                  <td className="px-4 py-2">
                    <ActionForm action={recordBuyerPaymentAction} success="Receipt recorded:">
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <PaymentFields max={outstanding(i)} />
                      <Submit>Record</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No open invoices.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Miner payables</h2>
        <p className="mt-1 text-sm text-muted">Owed once QC passes: verified tonnes at the PO price.</p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>PO</th>
                <th className={th}>Miner</th>
                <th className={`${th} text-right`}>Owed</th>
                <th className={`${th} text-right`}>Outstanding</th>
                <th className={th}>Record payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {payables.map(({ po, owed, out }) => (
                <tr key={po.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{po.reference}</div>
                    <Badge>{po.status}</Badge>
                  </td>
                  <td className="px-4 py-2">{po.miner.organization.name}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtMoney(owed)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtMoney(out)}</td>
                  <td className="px-4 py-2">
                    <ActionForm action={recordMinerPayoutAction} success="Payout recorded:">
                      <input type="hidden" name="poId" value={po.id} />
                      <PaymentFields max={Math.round(out * 100) / 100} />
                      <Submit>Record</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {payables.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No miner balances outstanding.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Ready to close</h2>
        <p className="mt-1 text-sm text-muted">Delivered, invoiced and paid in full.</p>
        <div className={card}>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-divider">
              {paid.map((so) => (
                <tr key={so.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{so.reference}</td>
                  <td className="px-4 py-2">{so.buyer.organization.name}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.orderedQuantity)}</td>
                  <td className="px-4 py-2">
                    <ActionForm action={closeSalesOrderAction} success="Closed.">
                      <input type="hidden" name="soId" value={so.id} />
                      <Submit>Close order</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {paid.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-muted">No fully paid orders waiting.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
