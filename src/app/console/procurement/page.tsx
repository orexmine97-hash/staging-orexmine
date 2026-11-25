import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtGrade, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { outstandingQuantity } from "@/lib/procurement";
import { acceptOfferAction } from "@/app/actions/procurement";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";

export const dynamic = "force-dynamic";

export default async function ProcurementConsole() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      miner: { include: { organization: { select: { name: true } } } },
      deliveries: { select: { verifiedQuantity: true, qcDecisions: { select: { decision: true } } } },
    },
  });

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">Purchase orders</h2>
      <p className="mt-1 text-sm text-muted">
        Offer → acceptance → delivery → QC. Offers are issued from Suppliers; deliveries are received in Receiving &amp; QC.
        Outstanding counts every delivery not failed at QC.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-divider bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-divider text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium">Supplier</th>
              <th className="px-4 py-2 font-medium">Commodity</th>
              <th className="px-4 py-2 text-right font-medium">Declared</th>
              <th className="px-4 py-2 text-right font-medium">Grade</th>
              <th className="px-4 py-2 text-right font-medium">Unit price</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Outstanding</th>
              <th className="px-4 py-2 text-right font-medium">Deliveries</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {orders.map((po) => (
              <tr key={po.id}>
                <td className="whitespace-nowrap px-4 py-2 font-medium">{po.reference}</td>
                <td className="px-4 py-2">
                  {po.miner.organization.name} <span className="text-xs text-muted">· {po.miner.reference}</span>
                </td>
                <td className="px-4 py-2">{po.commodity}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(po.declaredQuantity)}</td>
                <td className="px-4 py-2 text-right">{po.declaredGrade != null ? fmtGrade(po.declaredGrade) : "—"}</td>
                <td className="px-4 py-2 text-right">{fmtPricePerT(po.unitPrice)}</td>
                <td className="px-4 py-2"><Badge>{po.status}</Badge></td>
                <td className="px-4 py-2 text-right">{fmtTonnes(Prisma.Decimal.max(0, outstandingQuantity(po.declaredQuantity, po.deliveries)))}</td>
                <td className="px-4 py-2 text-right text-muted">{po.deliveries.length}</td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDate(po.createdAt)}</td>
                <td className="px-4 py-2">
                  {po.status === "OFFERED" && (
                    <ActionForm action={acceptOfferAction} success="Accepted.">
                      <input type="hidden" name="purchaseOrderId" value={po.id} />
                      <input name="reason" required placeholder="Acceptance ref (call, signed offer)" className="w-44 rounded border border-divider bg-bg px-2 py-1 text-xs" />
                      <Submit>Accept</Submit>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-muted">No purchase orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
