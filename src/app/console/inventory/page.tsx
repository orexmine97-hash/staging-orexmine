import { prisma } from "@/lib/prisma";
import { fmtGrade, fmtTonnes } from "@/lib/format";
import { Badge } from "../ui";

export const dynamic = "force-dynamic";

// Every batch across every status — the ops view the buyer catalog (SELLABLE
// only) deliberately hides. Quantity buckets show where stock sits.
export default async function InventoryConsole() {
  const batches = await prisma.inventoryBatch.findMany({
    orderBy: [{ status: "asc" }, { commodity: "asc" }, { grade: "desc" }],
    take: 200,
  });

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">Inventory</h2>
      <p className="mt-1 text-sm text-muted">{batches.length} batch{batches.length === 1 ? "" : "es"} across all statuses.</p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-divider bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-divider text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Batch</th>
              <th className="px-4 py-2 font-medium">Commodity</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Grade</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2 text-right font-medium">Available</th>
              <th className="px-4 py-2 text-right font-medium">Reserved</th>
              <th className="px-4 py-2 text-right font-medium">Held</th>
              <th className="px-4 py-2 text-right font-medium">Rejected</th>
              <th className="px-4 py-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap px-4 py-2 font-medium">{b.batchNumber}</td>
                <td className="px-4 py-2">{b.commodity}</td>
                <td className="px-4 py-2"><Badge>{b.status}</Badge></td>
                <td className="px-4 py-2 text-right">{fmtGrade(b.grade, b.gradeUnit)}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(b.quantity)}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(b.availableQuantity)}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(b.reservedQuantity)}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(b.heldQuantity)}</td>
                <td className="px-4 py-2 text-right">{fmtTonnes(b.rejectedQuantity)}</td>
                <td className="px-4 py-2 text-muted">{b.location}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-muted">No batches yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
