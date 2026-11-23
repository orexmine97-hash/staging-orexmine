import { prisma } from "@/lib/prisma";
import { fmtDate, fmtGrade, fmtTonnes } from "@/lib/format";
import { Prisma } from "@prisma/client";
import { getSessionActor } from "@/lib/auth";
import { RECEIVABLE_STATES, outstandingQuantity } from "@/lib/procurement";
import { receiveDeliveryAction } from "@/app/actions/procurement";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";
import { QcDecisionForm } from "./qc-form";

const input = "rounded border border-divider bg-bg px-2 py-1 text-xs";

export const dynamic = "force-dynamic";

export default async function QcConsole() {
  const actor = await getSessionActor();
  const canDecide = actor.role === "QUALITY_COMPLIANCE" || actor.role === "ADMIN";
  const [openPos, holds, decisions] = await Promise.all([
    // Accepted POs still owed tonnes — the inbound queue the gate works from (FR-13).
    prisma.purchaseOrder.findMany({
      where: { status: { in: RECEIVABLE_STATES } },
      orderBy: { createdAt: "asc" },
      include: {
        miner: { select: { reference: true, organization: { select: { name: true } } } },
        deliveries: { select: { verifiedQuantity: true, qcDecisions: { select: { decision: true } } } },
      },
    }),
    // Batches quarantined pending a QC decision — the queue QC works from.
    prisma.inventoryBatch.findMany({
      where: { status: "QC_HOLD" },
      orderBy: { createdAt: "asc" },
      include: {
        sourceDelivery: {
          include: {
            purchaseOrder: { select: { reference: true, declaredGrade: true } },
            assays: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    }),
    prisma.qcDecision.findMany({
      orderBy: { decidedAt: "desc" },
      take: 20,
      include: { delivery: { select: { reference: true } } },
    }),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-heading text-lg font-semibold">Awaiting delivery</h2>
        <p className="mt-1 text-sm text-muted">
          Accepted purchase orders with tonnes still outstanding. Record each delivery as it arrives — partial loads keep the PO
          open — with the weighbridge figure and assay. The batch lands on QC hold.
        </p>
        <div className="mt-4 space-y-2">
          {openPos
            .map((po) => ({ po, open: outstandingQuantity(po.declaredQuantity, po.deliveries) }))
            .filter(({ open }) => open.gt(0))
            .map(({ po, open }) => (
              <div key={po.id} className="rounded-lg border border-divider bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{po.reference}</span>
                  <span className="text-xs text-muted">{po.miner.organization.name} · {po.miner.reference} · {po.commodity}</span>
                  <Badge>{po.status}</Badge>
                  <span className="text-xs">Outstanding {fmtTonnes(open)} of {fmtTonnes(po.declaredQuantity)}</span>
                  {po.declaredGrade != null && <span className="text-xs text-muted">declared {fmtGrade(po.declaredGrade)}</span>}
                </div>
                <ActionForm action={receiveDeliveryAction} success="Received" className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="purchaseOrderId" value={po.id} />
                  <input name="declaredQuantity" type="number" step="0.001" min="0.001" required defaultValue={Number(Prisma.Decimal.min(open, po.declaredQuantity))} aria-label="Declared on waybill (t)" title="Declared on waybill (t)" className={`${input} w-24`} />
                  <input name="verifiedQuantity" type="number" step="0.001" min="0.001" required placeholder="Weighbridge t" className={`${input} w-28`} />
                  <input name="testedGrade" type="number" step="0.01" min="0" max="100" required placeholder="Assay grade %" className={`${input} w-28`} />
                  <input name="laboratory" placeholder="Laboratory" className={`${input} w-28`} />
                  <input name="sampleReference" placeholder="Sample ref" className={`${input} w-24`} />
                  <input name="location" required placeholder="Custody location" defaultValue={po.targetLocation ?? ""} className={`${input} w-32`} />
                  <input name="reason" placeholder="Waybill / note" className={`${input} w-32`} />
                  <Submit>Receive</Submit>
                </ActionForm>
              </div>
            ))}
          {openPos.every((po) => outstandingQuantity(po.declaredQuantity, po.deliveries).lte(0)) && (
            <p className="text-sm text-muted">No accepted purchase orders awaiting delivery.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Awaiting decision</h2>
        <p className="mt-1 text-sm text-muted">
          {holds.length} batch{holds.length === 1 ? "" : "es"} on QC hold. A pass makes the batch sellable; a fail rejects it.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-divider bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Batch</th>
                <th className="px-4 py-2 font-medium">Commodity</th>
                <th className="px-4 py-2 text-right font-medium">Verified</th>
                <th className="px-4 py-2 text-right font-medium">Declared grade</th>
                <th className="px-4 py-2 text-right font-medium">Assayed grade</th>
                <th className="px-4 py-2 text-right font-medium">Variance</th>
                <th className="px-4 py-2 font-medium">Delivery</th>
                <th className="px-4 py-2 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {holds.map((b) => {
                const del = b.sourceDelivery;
                const assayed = del?.assays[0]?.testedGrade ?? null;
                const declared = del?.purchaseOrder.declaredGrade ?? null;
                const variance = assayed != null && declared != null ? Number(assayed) - Number(declared) : null;
                return (
                  <tr key={b.id}>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">{b.batchNumber}</td>
                    <td className="px-4 py-2">{b.commodity}</td>
                    <td className="px-4 py-2 text-right">{fmtTonnes(b.quantity)}</td>
                    <td className="px-4 py-2 text-right">{declared != null ? fmtGrade(declared) : "—"}</td>
                    <td className="px-4 py-2 text-right">{assayed != null ? fmtGrade(assayed) : "—"}</td>
                    <td className="px-4 py-2 text-right">{variance != null ? `${variance > 0 ? "+" : ""}${variance.toFixed(1)}pp` : "—"}</td>
                    <td className="px-4 py-2 text-muted">{del?.reference ?? "—"}</td>
                    <td className="px-4 py-2">
                      {!canDecide ? <span className="text-xs text-muted">QC decides</span> : del ? <QcDecisionForm deliveryId={del.id} /> : <span className="text-xs text-muted">no delivery</span>}
                    </td>
                  </tr>
                );
              })}
              {holds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted">Nothing on QC hold.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold">Recent decisions</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-divider bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Decision</th>
                <th className="px-4 py-2 font-medium">Delivery</th>
                <th className="px-4 py-2 text-right font-medium">Variance</th>
                <th className="px-4 py-2 font-medium">By</th>
                <th className="px-4 py-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {decisions.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDate(d.decidedAt)}</td>
                  <td className="px-4 py-2"><Badge>{d.decision}</Badge></td>
                  <td className="px-4 py-2 text-muted">{d.delivery.reference}</td>
                  <td className="px-4 py-2 text-right">{d.gradeVariance != null ? `${Number(d.gradeVariance) > 0 ? "+" : ""}${Number(d.gradeVariance).toFixed(1)}pp` : "—"}</td>
                  <td className="px-4 py-2">{d.decidedByName}</td>
                  <td className="px-4 py-2 text-muted">{d.reason}</td>
                </tr>
              ))}
              {decisions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">No decisions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
