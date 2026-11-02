import { prisma } from "@/lib/prisma";
import { fmtDate, fmtTonnes } from "@/lib/format";
import { deliverShipmentAction, dispatchOrderAction, returnShipmentAction } from "@/app/actions/logistics";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";

export const dynamic = "force-dynamic";

const card = "mt-3 overflow-x-auto rounded-lg border border-divider bg-surface";
const th = "px-4 py-2 font-medium";
const small = "rounded border border-divider bg-bg px-2 py-1 text-xs";

const party = {
  include: {
    buyer: { include: { organization: { select: { name: true } } } },
    batch: { select: { batchNumber: true, location: true } },
  },
} as const;

// Outbound fulfilment (FR-56/57): ship what the trade desk reserved, then
// close each shipment as delivered (with POD) or returned.
export default async function Logistics() {
  const [ready, open, closed] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: { in: ["RESERVED", "PARTIAL"] }, reservedQuantity: { gt: 0 } },
      orderBy: { confirmedAt: "asc" },
      ...party,
    }),
    prisma.shipment.findMany({
      where: { direction: "OUTBOUND", status: { in: ["PENDING", "IN_TRANSIT", "HELD"] } },
      orderBy: { createdAt: "asc" },
      include: { salesOrder: party },
    }),
    prisma.shipment.findMany({
      where: { direction: "OUTBOUND", status: { in: ["DELIVERED", "RETURNED"] } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: { salesOrder: party },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-heading text-lg font-semibold">Ready to dispatch</h2>
        <p className="mt-1 text-sm text-muted">Orders with stock reserved. Ship part or all of the reserved quantity.</p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Buyer · destination</th>
                <th className={th}>Batch · location</th>
                <th className={`${th} text-right`}>Ordered</th>
                <th className={`${th} text-right`}>Reserved</th>
                <th className={`${th} text-right`}>Dispatched</th>
                <th className={th}>Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {ready.map((so) => (
                <tr key={so.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{so.reference}</div>
                    <Badge>{so.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div>{so.buyer.organization.name}</div>
                    <div className="text-xs text-muted">
                      {so.destination ?? "—"}
                      {so.deliveryTerms ? ` · ${so.deliveryTerms}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div>{so.batch.batchNumber}</div>
                    <div className="text-xs text-muted">{so.batch.location}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.orderedQuantity)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.reservedQuantity)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmtTonnes(so.dispatchedQuantity)}</td>
                  <td className="px-4 py-2">
                    <ActionForm action={dispatchOrderAction} success="Dispatched:">
                      <input type="hidden" name="soId" value={so.id} />
                      <label className="flex items-center gap-1 text-xs text-muted">
                        <input
                          name="quantity"
                          type="number"
                          step="0.1"
                          min="0.1"
                          max={Number(so.reservedQuantity)}
                          defaultValue={Number(so.reservedQuantity)}
                          required
                          className={`${small} w-20 text-text`}
                        />
                        t
                      </label>
                      <input name="carrier" required placeholder="Carrier" className={`${small} w-28`} />
                      <input name="trackingRef" placeholder="Tracking / waybill" className={`${small} w-32`} />
                      <input name="route" placeholder="Route" className={`${small} w-28`} />
                      <label className="flex items-center gap-1 text-xs text-muted">
                        ETA
                        <input name="expectedAt" type="date" className={`${small} text-text`} />
                      </label>
                      <input name="cost" type="number" min="0" step="1" placeholder="Cost ₦" className={`${small} w-24`} />
                      <Submit>Dispatch</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {ready.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Nothing reserved and waiting to ship.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">In transit</h2>
        <p className="mt-1 text-sm text-muted">
          Delivery needs a proof-of-delivery reference. A return puts the tonnes on hold for re-inspection.
        </p>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Shipment</th>
                <th className={th}>Order · buyer</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={th}>Carrier · tracking</th>
                <th className={th}>ETA</th>
                <th className={th}>Close out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {open.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="font-medium">{s.reference}</div>
                    <Badge>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div>{s.salesOrder?.reference ?? "—"}</div>
                    <div className="text-xs text-muted">{s.salesOrder?.buyer.organization.name}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {s.quantity != null ? fmtTonnes(s.quantity) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div>{s.carrier ?? "—"}</div>
                    <div className="text-xs text-muted">
                      {s.trackingRef ?? ""}
                      {s.route ? ` · ${s.route}` : ""}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{s.expectedAt ? fmtDate(s.expectedAt).slice(0, 10) : "—"}</td>
                  <td className="px-4 py-2"><div className="flex flex-col gap-2">
                    <ActionForm action={deliverShipmentAction} success="Delivered.">
                      <input type="hidden" name="shipmentId" value={s.id} />
                      <input name="pod" required placeholder="POD reference" className={`${small} w-32`} />
                      <Submit>Delivered</Submit>
                    </ActionForm>
                    <ActionForm action={returnShipmentAction} success="Returned.">
                      <input type="hidden" name="shipmentId" value={s.id} />
                      <input name="reason" required placeholder="Failure / return reason" className={`${small} w-32`} />
                      <Submit tone="ghost">Returned</Submit>
                    </ActionForm>
                  </div></td>
                </tr>
              ))}
              {open.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No shipments on the road.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Recently closed</h2>
        <div className={card}>
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className={th}>Shipment</th>
                <th className={th}>Order · buyer</th>
                <th className={`${th} text-right`}>Qty</th>
                <th className={th}>Outcome</th>
                <th className={th}>POD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {closed.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">{s.reference}</td>
                  <td className="px-4 py-2">
                    {s.salesOrder?.reference ?? "—"}{" "}
                    <span className="text-xs text-muted">· {s.salesOrder?.buyer.organization.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                    {s.quantity != null ? fmtTonnes(s.quantity) : "—"}
                  </td>
                  <td className="px-4 py-2"><Badge>{s.status}</Badge></td>
                  <td className="px-4 py-2 text-xs">{s.podReference ?? "—"}</td>
                </tr>
              ))}
              {closed.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No closed shipments yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
