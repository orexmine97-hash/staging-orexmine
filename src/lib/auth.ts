import { UserRole } from "@prisma/client";
import { auth0, ROLES_CLAIM } from "@/lib/auth0";
import type { Actor } from "@/lib/reservations";

export { ROLES_CLAIM };

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

export function roleFromClaim(claim: unknown): UserRole | null {
  const list = Array.isArray(claim) ? claim : claim == null ? [] : [claim];
  return (list.find((r) => typeof r === "string" && VALID_ROLES.has(r)) as UserRole) ?? null;
}

// Resolves the authenticated principal from the Auth0 session. Server actions
// call this; a direct POST with no session throws here rather than proceeding.
export async function getSessionActor(): Promise<Actor> {
  const session = await auth0.getSession();
  if (!session?.user) {
    throw new AuthError("UNAUTHENTICATED", "Sign in required.");
  }
  const role = roleFromClaim(session.user[ROLES_CLAIM]);
  if (!role) {
    throw new AuthError("NO_ROLE", "This account has no OREXMINE role assigned.");
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
