import { prisma } from "@/lib/prisma";
import { COMMODITY, commodityLabel, fmtDate, fmtPricePerT, fmtTonnes } from "@/lib/format";
import { CHECKLIST, PILLAR_MAX, blockingDocuments } from "@/lib/suppliers";
import { recordMinerDocumentAction, registerMinerAction, vetMinerAction } from "@/app/actions/suppliers";
import { createOfferAction } from "@/app/actions/procurement";
import { Badge } from "../ui";
import { ActionForm, Submit } from "../action-form";

export const dynamic = "force-dynamic";

const input = "rounded border border-divider bg-bg px-2 py-1 text-xs";
const OFFERABLE = ["PREFERRED", "CONDITIONAL"];
const PILLARS = [
  ["legal", "Legal", "scoreLegal"],
  ["source", "Source", "scoreSource"],
  ["quality", "Quality/qty", "scoreQuality"],
  ["reliability", "Reliability", "scoreReliability"],
] as const;

export default async function SuppliersConsole() {
  const miners = await prisma.miner.findMany({
    orderBy: [{ nextReviewAt: "asc" }, { reference: "asc" }],
    include: {
      organization: { select: { name: true, status: true } },
      documents: { orderBy: { createdAt: "asc" }, include: { documents: { orderBy: { createdAt: "desc" }, take: 1 } } },
      _count: { select: { purchaseOrders: true } },
    },
  });
  // FR-08: vetting, document and tier history is the append-only audit trail on the miner reference.
  const history = await prisma.auditEvent.findMany({
    where: { recordType: "Miner", recordId: { in: miners.map((m) => m.reference) } },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return (
    <div>
      <h2 className="font-heading text-lg font-semibold">Suppliers</h2>
      <p className="mt-1 text-sm text-muted">
        Register, document and score miners. The total score sets the tier and review date; only Preferred or Conditional
        suppliers with every required document on file can receive an offer. Every change is audited.
      </p>

      <details className="mt-4 rounded-lg border border-divider bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">Register a supplier</summary>
        <ActionForm action={registerMinerAction} success="Registered" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input name="name" required placeholder="Legal / trading name" className={input} />
          <select name="scale" required className={input} defaultValue="ARTISANAL">
            <option value="ARTISANAL">Artisanal / small-scale ({CHECKLIST.ARTISANAL.length} docs)</option>
            <option value="CORPORATE">Large-scale / corporate ({CHECKLIST.CORPORATE.length} docs)</option>
          </select>
          <fieldset className="flex flex-wrap items-center gap-3 text-xs text-muted">
            {Object.entries(COMMODITY).map(([key, c]) => (
              <label key={key} className="flex items-center gap-1">
                <input type="checkbox" name="commodities" value={key} /> {c.short}
              </label>
            ))}
          </fieldset>
          <input name="miningTitleReference" placeholder="Mining title (e.g. SSML 24 118)" className={input} />
          <input name="rcNumber" placeholder="CAC RC number" className={input} />
          <input name="siteDescription" placeholder="Site (LGA, State)" className={input} />
          <input name="siteLatitude" type="number" step="0.000001" min="-90" max="90" placeholder="Site latitude" className={input} />
          <input name="siteLongitude" type="number" step="0.000001" min="-180" max="180" placeholder="Site longitude" className={input} />
          <input name="bankAccountRef" placeholder="Bank / account reference" className={input} />
          <input name="monthlyCapTonnes" type="number" step="0.1" min="0" placeholder="Monthly cap (t)" className={input} />
          <div><Submit>Register</Submit></div>
        </ActionForm>
      </details>

      <div className="mt-4 space-y-3">
        {miners.map((m) => {
          const total = m.scoreLegal == null ? null : PILLARS.reduce((s, [, , f]) => s + (m[f] ?? 0), 0);
          const blocking = blockingDocuments(m.documents, now);
          const overdue = m.nextReviewAt != null && m.nextReviewAt < now;
          const offerable = OFFERABLE.includes(m.tier) && m.organization.status === "ACTIVE" && blocking.length === 0;
          const events = history.filter((e) => e.recordId === m.reference);
          return (
            <details key={m.id} className="rounded-lg border border-divider bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{m.organization.name}</span>
                <span className="text-xs text-muted">{m.reference} · {m.scale === "CORPORATE" ? "Corporate" : "Artisanal"}</span>
                <Badge>{m.tier}</Badge>
                <Badge>{m.organization.status}</Badge>
                <span className="text-xs text-muted">Score {total ?? "—"}/100</span>
                <span className={`text-xs ${overdue ? "font-medium text-red-700" : "text-muted"}`}>
                  Review {m.nextReviewAt ? fmtDate(m.nextReviewAt).slice(0, 10) : "—"}{overdue ? " · overdue" : ""}
                </span>
                {blocking.length > 0 && <span className="text-xs text-amber">{blocking.length} doc(s) outstanding</span>}
              </summary>

              <div className="grid gap-6 border-t border-divider px-4 py-4 lg:grid-cols-2">
                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Profile</h3>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted">Commodities</dt><dd>{m.commodities.map(commodityLabel).join(", ") || "—"}</dd>
                    <dt className="text-muted">Mining title</dt><dd>{m.miningTitleReference ?? "—"}</dd>
                    <dt className="text-muted">RC number</dt><dd>{m.rcNumber ?? "—"}</dd>
                    <dt className="text-muted">Site</dt>
                    <dd>{m.siteDescription ?? "—"}{m.siteLatitude != null ? ` (${m.siteLatitude}, ${m.siteLongitude})` : ""}</dd>
                    <dt className="text-muted">Bank</dt><dd>{m.bankAccountRef ?? "—"} · {m.bankVerified ? "verified" : "unverified"}</dd>
                    <dt className="text-muted">Monthly cap</dt><dd>{m.monthlyCapTonnes != null ? fmtTonnes(m.monthlyCapTonnes) : "—"}</dd>
                    <dt className="text-muted">Purchase orders</dt><dd>{m._count.purchaseOrders}</dd>
                  </dl>

                  <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Vetting score</h3>
                  <ActionForm action={vetMinerAction} success="Scored." className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="minerId" value={m.id} />
                    {PILLARS.map(([name, label, field]) => (
                      <label key={name} className="flex flex-col gap-0.5 text-xs text-muted">
                        {label}
                        <input name={name} type="number" min="0" max={PILLAR_MAX} step="1" required defaultValue={m[field] ?? ""} className={`${input} w-16 text-text`} />
                      </label>
                    ))}
                    <label className="flex flex-col gap-0.5 text-xs text-muted">
                      Next review (blank = by tier)
                      <input name="nextReviewAt" type="date" className={`${input} text-text`} />
                    </label>
                    <input name="reason" required placeholder="Reason / evidence" className={`${input} w-40`} />
                    <Submit>Score</Submit>
                  </ActionForm>
                  <p className="mt-1 text-xs text-muted">Each pillar 0–{PILLAR_MAX}. Total ≥ 85 Preferred, ≥ 80 Conditional, ≥ 60 Probationary.</p>

                  {offerable && (
                    <>
                      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Issue purchase offer</h3>
                      <ActionForm action={createOfferAction} success="Offer issued" className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="minerId" value={m.id} />
                        <select name="commodity" required className={input}>
                          {(m.commodities.length ? m.commodities : Object.keys(COMMODITY)).map((c) => (
                            <option key={c} value={c}>{commodityLabel(c)}</option>
                          ))}
                        </select>
                        <input name="quantity" type="number" step="0.1" min="0.1" max={m.monthlyCapTonnes?.toString()} required placeholder="t" className={`${input} w-20`} />
                        <input name="grade" type="number" step="0.1" min="0" max="100" placeholder="Grade %" className={`${input} w-20`} />
                        <input name="unitPrice" type="number" step="1000" min="1" required placeholder="₦ per t" className={`${input} w-28`} />
                        <input name="reason" placeholder="Note" className={`${input} w-32`} />
                        <Submit>Offer</Submit>
                      </ActionForm>
                      {m.monthlyCapTonnes != null && (
                        <p className="mt-1 text-xs text-muted">Cap {fmtTonnes(m.monthlyCapTonnes)} per offer. Price in naira per tonne ({fmtPricePerT(10_200_000)} = 10200000).</p>
                      )}
                    </>
                  )}
                </section>

                <section>
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Document checklist</h3>
                  <ul className="mt-2 divide-y divide-divider text-xs">
                    {m.documents.map((d) => {
                      const expired = d.expiresAt != null && d.expiresAt < now;
                      return (
                        <li key={d.id} className="py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{d.name}</span>
                            <Badge>{expired ? "EXPIRED" : d.state}</Badge>
                            {d.documents[0] && <span className="text-muted">{d.documents[0].name}</span>}
                            {d.expiresAt && <span className="text-muted">expires {fmtDate(d.expiresAt).slice(0, 10)}</span>}
                          </div>
                          <ActionForm action={recordMinerDocumentAction} success="Saved." className="mt-1 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="minerDocumentId" value={d.id} />
                            <select name="state" required className={input} defaultValue="ON_FILE">
                              <option value="ON_FILE">On file</option>
                              <option value="PENDING">Pending</option>
                              <option value="EXPIRED">Expired</option>
                              <option value="MISSING">Missing</option>
                            </select>
                            <input name="reference" placeholder="File / doc reference" className={`${input} w-36`} />
                            <input name="expiresAt" type="date" aria-label="Expiry date" className={input} />
                            <input name="reason" placeholder="Reason" className={`${input} w-28`} />
                            <Submit tone="ghost">Record</Submit>
                          </ActionForm>
                        </li>
                      );
                    })}
                  </ul>

                  <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">History</h3>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
                    {events.map((e) => (
                      <li key={e.id}>
                        <span className="text-muted">{fmtDate(e.createdAt)} · {e.actorName}</span> — {e.action}: {e.before} → {e.after}
                        {e.reason && e.reason !== e.action ? <span className="text-muted"> ({e.reason})</span> : null}
                      </li>
                    ))}
                    {events.length === 0 && <li className="text-muted">No recorded changes yet.</li>}
                  </ul>
                </section>
              </div>
            </details>
          );
        })}
        {miners.length === 0 && <p className="text-sm text-muted">No suppliers yet.</p>}
      </div>
    </div>
  );
}
