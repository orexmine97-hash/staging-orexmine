import { prisma } from "@/lib/prisma";
import { fmtDate, fmtGrade, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { Badge } from "../ui";

export const dynamic = "force-dynamic";

export default async function ProcurementConsole() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      miner: { include: { organization: { select: { name: true } } } },
      _count: { select: { deliveries: true } },
    },
  });

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">Purchase orders</h2>
      <p className="mt-1 text-sm text-muted">Offer → acceptance → delivery → QC. Full pipeline, all statuses.</p>

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
              <th className="px-4 py-2 text-right font-medium">Deliveries</th>
              <th className="px-4 py-2 font-medium">Created</th>
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
                <td className="px-4 py-2 text-right text-muted">{po._count.deliveries}</td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDate(po.createdAt)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted">No purchase orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
