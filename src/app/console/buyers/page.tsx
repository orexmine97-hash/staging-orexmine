import { prisma } from "@/lib/prisma";
import { fmtDate, fmtMoney } from "@/lib/format";
import { setBuyerKycAction } from "@/app/actions/sales";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";

export const dynamic = "force-dynamic";

// KYC decisions offered from each state (FR-31).
const NEXT: Record<string, [string, string][]> = {
  PENDING: [["APPROVED", "Approve"], ["REJECTED", "Reject"]],
  RENEWAL_DUE: [["APPROVED", "Renew"], ["SUSPENDED", "Suspend"]],
  APPROVED: [["SUSPENDED", "Suspend"]],
  SUSPENDED: [["APPROVED", "Reinstate"], ["REJECTED", "Reject"]],
  REJECTED: [["APPROVED", "Approve"]],
};

export default async function BuyersConsole() {
  const buyers = await prisma.buyer.findMany({
    orderBy: [{ kycStatus: "asc" }, { reference: "asc" }],
    include: {
      organization: { select: { name: true } },
      _count: { select: { quotes: true, salesOrders: true } },
    },
  });

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">Buyers</h2>
      <p className="mt-1 text-sm text-muted">
        KYC review. Only approved buyers can hold a quote or confirm an order; every decision needs a reason and is audited.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-divider bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-divider text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Buyer</th>
              <th className="px-4 py-2 font-medium">KYC</th>
              <th className="px-4 py-2 font-medium">End use</th>
              <th className="px-4 py-2 text-right font-medium">Credit limit</th>
              <th className="px-4 py-2 font-medium">Terms</th>
              <th className="px-4 py-2 text-right font-medium">Quotes / SOs</th>
              <th className="px-4 py-2 font-medium">Approved</th>
              <th className="px-4 py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {buyers.map((b) => (
              <tr key={b.id} className="align-top">
                <td className="px-4 py-2">
                  <div className="font-medium">{b.organization.name}</div>
                  <div className="text-xs text-muted">{b.reference}</div>
                </td>
                <td className="px-4 py-2"><Badge>{b.kycStatus}</Badge></td>
                <td className="px-4 py-2 text-muted">{b.endUseDeclaration ?? "—"}</td>
                <td className="px-4 py-2 text-right">{b.creditLimit != null ? fmtMoney(b.creditLimit) : "—"}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {b.prepaymentRequired ? "Prepayment" : b.depositRequiredPct ? `${b.depositRequiredPct}% deposit` : "Standard"}
                </td>
                <td className="px-4 py-2 text-right text-muted">{b._count.quotes} / {b._count.salesOrders}</td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{b.kycApprovedAt ? fmtDate(b.kycApprovedAt) : "—"}</td>
                <td className="px-4 py-2">
                  <ActionForm action={setBuyerKycAction} success="Saved.">
                    <input type="hidden" name="buyerId" value={b.id} />
                    <select name="status" required className="rounded border border-divider bg-bg px-2 py-1 text-xs">
                      {(NEXT[b.kycStatus] ?? []).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                    <input name="reason" required placeholder="Reason" className="w-32 rounded border border-divider bg-bg px-2 py-1 text-xs" />
                    <Submit>Record</Submit>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {buyers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">No buyers yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
