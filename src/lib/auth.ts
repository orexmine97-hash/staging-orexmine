import { UserRole } from "@prisma/client";
import { auth0 } from "@/lib/auth0";
import type { Actor } from "@/lib/reservations";

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "NO_ROLE",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthError";
  }
}

const VALID_ROLES: ReadonlySet<string> = new Set(Object.values(UserRole));

// The internal ops console (FR-75) is for staff only — MINER/BUYER are external
// portal roles and must never reach it. ADMIN is the System Administrator (§5):
// the super admin with all-access, incl. the audit log.
export const STAFF_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.PROCUREMENT,
  UserRole.SALES,
  UserRole.QUALITY_COMPLIANCE,
  UserRole.WAREHOUSE_LOGISTICS,
  UserRole.FINANCE,
];
export const isStaff = (role: UserRole) => STAFF_ROLES.includes(role);

// Reads the role stamped onto the session from the DB at login (see auth0.ts).
// A deactivated account (active === false) resolves to no role.
export function sessionRole(user: unknown): UserRole | null {
  const u = user as Record<string, unknown> | null | undefined;
  if (!u || u.active === false) return null;
  return typeof u.role === "string" && VALID_ROLES.has(u.role) ? (u.role as UserRole) : null;
}

// Resolves the authenticated principal from the Auth0 session. Server actions
// call this; a direct POST with no session throws here rather than proceeding.
export async function getSessionActor(): Promise<Actor> {
  const session = await auth0.getSession();
  if (!session?.user) {
    throw new AuthError("UNAUTHENTICATED", "Sign in required.");
  }
  const role = sessionRole(session.user);
  if (!role) {
    throw new AuthError("NO_ROLE", "This account has no active OREXMINE role assigned.");
  }
  return {
    id: session.user.sub, // OIDC subject — matches the *ById columns in the schema
    name: session.user.name ?? session.user.email ?? session.user.sub,
    role,
  };
}

export function assertRole(actor: Actor, ...allowed: UserRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new Error(`FORBIDDEN: ${actor.role} may not perform this action.`);
  }
}
