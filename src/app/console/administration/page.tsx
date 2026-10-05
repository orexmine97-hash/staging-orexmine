import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { isMgmtConfigured } from "@/lib/auth0-management";
import { Badge } from "../ui";
import { ROLE_LABEL } from "../access";
import { ActiveButton, CreateUserForm, RoleForm } from "./user-forms";

export const dynamic = "force-dynamic"; // live user directory

// Staff role options — the admin screen manages internal staff only; external
// MINER/BUYER accounts come from their own onboarding flows.
const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));

export default async function Administration() {
  const users = await prisma.user.findMany({
    where: { organization: { type: "OREXMINE" } },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold">Administration</h1>
        <p className="text-xs text-muted">Staff accounts &amp; roles (FR-75)</p>
      </div>

      {!isMgmtConfigured && (
        <p className="mt-3 rounded-md border border-amber/30 bg-amber/5 p-3 text-xs text-amber">
          Auth0 Management API isn&rsquo;t configured, so new users can&rsquo;t be provisioned yet. Set
          <code className="mx-1 font-mono">AUTH0_MGMT_CLIENT_ID</code> and
          <code className="mx-1 font-mono">AUTH0_MGMT_CLIENT_SECRET</code> (a Machine-to-Machine app authorized for the Management API).
        </p>
      )}

      <section className="mt-6 rounded-lg border border-divider bg-surface p-5">
        <h2 className="font-heading text-sm font-semibold">Add a staff member</h2>
        <p className="mb-4 mt-0.5 text-xs text-muted">
          Creates the account and returns an invite link they use to set their own password.
        </p>
        <CreateUserForm roles={ROLE_OPTIONS} />
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Staff</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-divider bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-divider text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {users.map((u) => (
                <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 text-muted">{u.email}</td>
                  <td className="px-4 py-2">
                    <RoleForm userId={u.id} role={u.role} roles={ROLE_OPTIONS} />
                  </td>
                  <td className="px-4 py-2">
                    <Badge>{u.active ? "ACTIVE" : "SUSPENDED"}</Badge>
                    {u.authId == null && <span className="ml-2 text-xs text-muted">invite pending</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-2">
                    <ActiveButton userId={u.id} active={u.active} />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">No staff yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
