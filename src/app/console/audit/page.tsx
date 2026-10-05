import { getSessionActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic"; // live audit trail

// ADMIN-only (super admin, §5). Enforced here as well as in the layout tab so a
// non-admin staff member who guesses the URL still can't read it.
export default async function AuditLog() {
  const actor = await getSessionActor();
  if (actor.role !== "ADMIN") {
    return <p className="text-sm text-muted">The audit log is restricted to administrators.</p>;
  }

  // ponytail: latest 200, no filter/paging yet — add when the trail outgrows one screen.
  const events = await prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold">Audit log</h2>
      <p className="mt-1 text-xs text-muted">Latest {events.length} events. Every privileged action and denial is recorded.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-divider bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-divider text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Change</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {events.map((e) => (
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
                <td className="px-4 py-2 text-xs text-muted">{e.reason ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
