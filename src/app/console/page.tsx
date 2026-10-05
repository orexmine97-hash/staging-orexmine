import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate, fmtTonnes } from "@/lib/format";

export const dynamic = "force-dynamic"; // live operational state

export default async function ConsoleOverview() {
  const [poCount, qcHold, activeRes, sellable, recent] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.inventoryBatch.count({ where: { status: "QC_HOLD" } }),
    prisma.reservation.count({ where: { status: "ACTIVE" } }),
    prisma.inventoryBatch.aggregate({ where: { status: "SELLABLE" }, _sum: { availableQuantity: true } }),
    prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  const cards: [string, string, string][] = [
    ["Awaiting QC", String(qcHold), "/console/qc"],
    ["Sellable available", fmtTonnes(sellable._sum.availableQuantity), "/console/inventory"],
    ["Active reservations", String(activeRes), "/console/inventory"],
    ["Purchase orders", String(poCount), "/console/procurement"],
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border border-divider bg-surface p-5 transition hover:border-accent"
          >
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-2 font-heading text-2xl font-semibold">{value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-heading text-lg font-semibold">Recent activity</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-divider bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Record</th>
                <th className="px-4 py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {recent.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDate(e.createdAt)}</td>
                  <td className="px-4 py-2">
                    {e.actorName} <span className="text-xs text-muted">· {e.actorRole}</span>
                  </td>
                  <td className="px-4 py-2">{e.action}</td>
                  <td className="px-4 py-2 text-muted">
                    {e.recordType} {e.recordId}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">
                    {e.before ? `${e.before} → ` : ""}
                    {e.after ?? "—"}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
