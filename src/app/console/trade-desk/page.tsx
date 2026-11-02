import { prisma } from "@/lib/prisma";
import { commodityLabel, fmtDate, fmtMoney, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { expectedMargin } from "@/lib/sales";
import { expireReservations } from "@/lib/reservations";
import {
  cancelSalesOrderAction,
  confirmQuoteAction,
  createQuoteAction,
  declineQuoteAction,
  issueQuoteAction,
  reReserveOrderAction,
  releaseOrderStockAction,
} from "@/app/actions/sales";
import { Badge } from "../ui";
import { ActionForm, type BatchOption, QuoteFields, Submit } from "../action-form";

export const dynamic = "force-dynamic";

const card = "mt-3 overflow-x-auto rounded-lg border border-divider bg-surface";
const th = "px-4 py-2 font-medium";
const small = "rounded border border-divider bg-bg px-2 py-1 text-xs";

function Margin({ qty, price, cost }: { qty: unknown; price: unknown; cost: unknown }) {
  const m = expectedMargin(String(qty), String(price), cost == null ? null : String(cost));
  if (!m) return <span className="text-muted">—</span>;
  return (
    <span className={m.total < 0 ? "text-red-700" : ""}>
      {fmtMoney(m.total)} <span className="text-xs text-muted">· {m.pct.toFixed(1)}%</span>
    </span>
  );
}

// A reason-required order action (release / cancel), same shape as Decline.
function WithReason({ action, soId, label }: { action: typeof cancelSalesOrderAction; soId: string; label: string }) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="soId" value={soId} />
      <input name="reason" required placeholder="Reason" className={`${small} w-24`} />
      <Submit tone="ghost">{label}</Submit>
    </ActionForm>
  );
}

function Decline({ quoteId }: { quoteId: string }) {
  return (
    <ActionForm action={declineQuoteAction}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input name="reason" required placeholder="Decline reason" className={`${small} w-28`} />
      <Submit tone="ghost">Decline</Submit>
    </ActionForm>
  );
}

export default async function TradeDesk({ searchParams }: PageProps<"/console/trade-desk">) {
  const { batch: preselect } = await searchParams;
  const now = new Date();
  // Lapsed holds give their stock back before the desk reads availability.
  await expireReservations();

  const [requests, open, orders, buyers, batches] = await Promise.all([
    prisma.quote.findMany({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      include: { buyer: { include: { organization: { select: { name: true } } } }, batch: true },
    }),
    prisma.quote.findMany({
      where: { status: "QUOTED" },
      orderBy: { validUntil: "asc" },
      include: { buyer: { include: { organization: { select: { name: true } } } }, batch: true },
    }),
    prisma.salesOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        buyer: { include: { organization: { select: { name: true } } } },
        batch: { select: { batchNumber: true } },
        reservations: { where: { status: "ACTIVE" }, select: { expiresAt: true } },
      },
    }),
    prisma.buyer.findMany({
      where: { kycStatus: "APPROVED" },
      orderBy: { reference: "asc" },
      include: { organization: { select: { name: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: { status: "SELLABLE", availableQuantity: { gt: 0 } },
      orderBy: [{ commodity: "asc" }, { batchNumber: "asc" }],
    }),
  ]);

  const options: BatchOption[] = batches.map((b) => ({
    id: b.id,
    label: `${b.batchNumber} · ${commodityLabel(b.commodity)} · ${fmtTonnes(b.availableQuantity)} avail`,
    ask: Number(b.unitPrice ?? 0),
    cost: b.unitCost != null ? Number(b.unitCost) : null,
    available: Number(b.availableQuantity),
  }));
  const preselectId = typeof preselect === "string" ? batches.find((b) => b.batchNumber === preselect)?.id : undefined;

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-heading text-lg font-semibold">New quote</h2>
        <p className="mt-1 text-sm text-muted">
          Approved buyers and sellable stock only. Cost is frozen on the quote so the margin can&rsquo;t drift later.
        </p>
        <div className="mt-3 rounded-lg border border-divider bg-surface p-4">
          <ActionForm action={createQuoteAction} success="Quote issued:">
            <select name="buyerId" required className={small}>
              <option value="">Buyer…</option>
              {buyers.map((b) => (
                <option key={b.id} value={b.id}>{b.organization.name} · {b.reference}</option>
              ))}
            </select>
            <QuoteFields batches={options} batchId={preselectId} showBatch />
            <Submit>Issue quote</Submit>
          </ActionForm>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">
          Quote requests <span className="text-sm font-normal text-muted">· {requests.length} from the showcase</span>
        </h2>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Request</th>
                <th className={th}>Buyer</th>
                <th className={th}>Batch</th>
                <th className={th}>Price and send</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {requests.map((q) => (
                <tr key={q.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{q.reference}</div>
                    <div className="text-xs text-muted">{fmtDate(q.createdAt)}</div>
                  </td>
                  <td className="px-4 py-2">{q.buyer.organization.name}</td>
                  <td className="px-4 py-2">
                    <div>{q.batch.batchNumber}</div>
                    <div className="text-xs text-muted">{fmtTonnes(q.quantity)} requested · ask {fmtPricePerT(q.unitPrice)}</div>
                  </td>
                  <td className="px-4 py-2"><div className="flex flex-col gap-2">
                    <ActionForm action={issueQuoteAction} success="Quote sent.">
                      <input type="hidden" name="quoteId" value={q.id} />
                      <QuoteFields
                        batches={options}
                        batchId={q.batchId}
                        quantity={Number(q.quantity)}
                        priceM={Number(q.unitPrice) / 1e6}
                      />
                      <Submit>Send quote</Submit>
                    </ActionForm>
                    <Decline quoteId={q.id} />
                  </div></td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">No open requests.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Open quotes</h2>
        <p className="mt-1 text-sm text-muted">
          Confirming records the buyer&rsquo;s acceptance: it creates the sales order and reserves the stock in one step.
        </p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Quote</th>
                <th className={th}>Buyer</th>
                <th className={th}>Batch</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={`${th} text-right`}>Price</th>
                <th className={`${th} text-right`}>Expected margin</th>
                <th className={th}>Valid until</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {open.map((q) => {
                const expired = q.validUntil != null && q.validUntil < now;
                return (
                  <tr key={q.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 font-medium">{q.reference}</td>
                    <td className="px-4 py-2">{q.buyer.organization.name}</td>
                    <td className="px-4 py-2">{q.batch.batchNumber}</td>
                    <td className="px-4 py-2 text-right">{fmtTonnes(q.quantity)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">{fmtPricePerT(q.unitPrice)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <Margin qty={q.quantity} price={q.unitPrice} cost={q.unitCostSnapshot} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {q.validUntil ? fmtDate(q.validUntil).slice(0, 10) : "—"}
                      {expired && <> <Badge>EXPIRED</Badge></>}
                    </td>
                    <td className="px-4 py-2"><div className="flex flex-col gap-2">
                      {!expired && (
                        <ActionForm action={confirmQuoteAction} success="Order confirmed:">
                          <input type="hidden" name="quoteId" value={q.id} />
                          <Submit>Confirm order</Submit>
                        </ActionForm>
                      )}
                      <Decline quoteId={q.id} />
                    </div></td>
                  </tr>
                );
              })}
              {open.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted">No open quotes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Sales orders</h2>
        <p className="mt-1 text-sm text-muted">Ordered, reserved, dispatched, delivered, invoiced and paid are tracked separately.</p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Buyer</th>
                <th className={th}>Batch</th>
                {["Ordered", "Reserved", "Dispatched", "Delivered", "Invoiced", "Paid"].map((h) => (
                  <th key={h} className={`${th} text-right`}>{h}</th>
                ))}
                <th className={`${th} text-right`}>Price</th>
                <th className={th}>Status</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {orders.map((so) => (
                <tr key={so.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{so.reference}</div>
                    <div className="text-xs text-muted">{so.confirmedAt ? fmtDate(so.confirmedAt).slice(0, 10) : "—"}</div>
                  </td>
                  <td className="px-4 py-2">{so.buyer.organization.name}</td>
                  <td className="px-4 py-2">{so.batch.batchNumber}</td>
                  {[so.orderedQuantity, so.reservedQuantity, so.dispatchedQuantity, so.deliveredQuantity, so.invoicedQuantity, so.paidQuantity].map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(v)}</td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2 text-right">{fmtPricePerT(so.unitPrice)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge>{so.status}</Badge>
                    {so.reservations[0]?.expiresAt && (
                      <div className="text-xs text-muted">held to {fmtDate(so.reservations[0].expiresAt).slice(0, 10)}</div>
                    )}
                  </td>
                  <td className="px-4 py-2"><div className="flex flex-col gap-2">
                    {so.status === "CONFIRMED" && (
                      <ActionForm action={reReserveOrderAction} success="Stock reserved.">
                        <input type="hidden" name="soId" value={so.id} />
                        <Submit>Re-reserve</Submit>
                      </ActionForm>
                    )}
                    {so.status === "RESERVED" && <WithReason action={releaseOrderStockAction} soId={so.id} label="Release stock" />}
                    {(so.status === "CONFIRMED" || so.status === "RESERVED") && (
                      <WithReason action={cancelSalesOrderAction} soId={so.id} label="Cancel order" />
                    )}
                  </div></td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-6 text-center text-muted">No sales orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
