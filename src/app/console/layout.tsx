import Link from "next/link";
import { auth0, isAuthConfigured } from "@/lib/auth0";
import { ROLES_CLAIM, roleFromClaim } from "@/lib/auth";

// Staff-only ops console — access is enforced in proxy.ts (only a staff session
// reaches here). This renders the sub-nav + sign-in state; the Audit log tab is
// ADMIN-only (the System Administrator / super admin, §5).
const TABS = [
  ["/console", "Overview"],
  ["/console/procurement", "Procurement"],
  ["/console/qc", "QC queue"],
  ["/console/inventory", "Inventory"],
] as const;

export default async function ConsoleLayout({ children }: LayoutProps<"/console">) {
  const session = isAuthConfigured ? await auth0.getSession() : null;
  const user = session?.user;
  const isAdmin = roleFromClaim(user?.[ROLES_CLAIM]) === "ADMIN";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-semibold">Ops console</h1>
        {user ? (
          <span className="text-xs text-muted">
            {user.name ?? user.email}
            {" · "}
            <a href="/auth/logout" className="text-accent hover:underline">Sign out</a>
          </span>
        ) : isAuthConfigured ? (
          <a
            href="/auth/login?returnTo=/console"
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            Sign in
          </a>
        ) : (
          <span className="text-xs text-muted">Sign-in disabled — Auth0 not configured</span>
        )}
      </div>
      <nav className="mt-4 flex flex-wrap gap-5 border-b border-divider pb-2 text-sm">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} className="text-muted hover:text-text">
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/console/audit" className="text-muted hover:text-text">
            Audit log
          </Link>
        )}
      </nav>
      <div className="mt-6">{children}</div>
    </main>
  );
}
