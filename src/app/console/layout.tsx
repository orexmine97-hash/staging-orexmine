import { auth0, isAuthConfigured } from "@/lib/auth0";
import { sessionRole } from "@/lib/auth";
import { ConsoleNav } from "./nav";
import { ROLE_LABEL } from "./access";

// Staff-only ops console shell — access is enforced in proxy.ts (only a staff
// session, and only modules the role may reach, get here). This renders the
// identity bar + role-scoped sidebar; pages fill the main column.
export default async function ConsoleLayout({ children }: LayoutProps<"/console">) {
  const session = isAuthConfigured ? await auth0.getSession() : null;
  const user = session?.user;
  const role = sessionRole(user);
  const roleLabel = role ? ROLE_LABEL[role] ?? role : null;
  const name = user?.name ?? user?.email ?? null;

  return (
    <div className="border-t border-divider">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider bg-surface px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="font-heading text-lg font-semibold">Orexmine ops</span>
          <span className="rounded bg-text px-2 py-0.5 text-xs font-medium text-bg">Osun gold pilot</span>
        </div>
        <div className="text-xs text-muted">
          {roleLabel && <span className="uppercase tracking-wide">{roleLabel}</span>}
          {name && <span> · {name}</span>}
          {" · "}
          <a href="/auth/logout" className="text-accent hover:underline">Sign out</a>
        </div>
      </div>

      {/* ponytail: stacks on mobile (nav above content); a real drawer/hamburger can come later. */}
      <div className="flex flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-divider px-3 py-5 md:w-56 md:border-b-0 md:border-r">
          <ConsoleNav role={role} />
        </aside>
        <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
