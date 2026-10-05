import { prisma } from "@/lib/prisma";
import { fmtDate, fmtGrade, fmtTonnes } from "@/lib/format";
import { Badge } from "../ui";
import { QcDecisionForm } from "./qc-form";

export const dynamic = "force-dynamic";

export default async function QcConsole() {
  const [holds, decisions] = await Promise.all([
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
                      {del ? <QcDecisionForm deliveryId={del.id} /> : <span className="text-xs text-muted">no delivery</span>}
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
