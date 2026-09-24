import { NextResponse, type NextRequest } from "next/server";
import { auth0, isAuthConfigured } from "@/lib/auth0";
import { ROLES_CLAIM, isStaff, roleFromClaim } from "@/lib/auth";
import { canAccess, moduleForPath } from "@/app/console/access";

// Next 16's middleware (formerly middleware.ts). Delegates to the Auth0 SDK,
// which mounts /auth/login, /auth/logout, /auth/callback etc. and keeps the
// rolling session cookie fresh, then gates the staff console (FR-75). Public
// pages never touch Auth0. Gating lives here, not in console/layout.tsx: a
// layout renders in parallel with its pages and can't reliably block them.
export default async function proxy(req: NextRequest) {
  const isConsole = req.nextUrl.pathname.startsWith("/console");

  // Auth0 off: the public showcase still works, but the staff console stays shut.
  if (!isAuthConfigured) {
    return isConsole ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }

  const authRes = await auth0.middleware(req);
  if (req.nextUrl.pathname.startsWith("/auth")) return authRes;

  // Console is staff-only: block anonymous, and external MINER/BUYER portal users.
  if (isConsole) {
    const session = await auth0.getSession(req);
    if (!session?.user) {
      return NextResponse.redirect(new URL("/auth/login?returnTo=/console", req.url));
    }
    const role = roleFromClaim(session.user[ROLES_CLAIM]);
    if (!role || !isStaff(role)) {
      return NextResponse.redirect(new URL("/?e=forbidden", req.url));
    }
    // Module-level RBAC (FRD §5): a greyed nav item is unreachable by direct URL
    // too. Denied modules bounce to the action queue, which every staff role has.
    if (!canAccess(role, moduleForPath(req.nextUrl.pathname))) {
      return NextResponse.redirect(new URL("/console?e=forbidden", req.url));
    }
  }
  return authRes;
}

// Only the routes that need a session — public pages never touch Auth0.
export const config = {
  matcher: ["/auth/:path*", "/console/:path*"],
};
