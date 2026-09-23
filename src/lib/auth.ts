import type { UserRole } from "@prisma/client";
import type { Actor } from "@/lib/reservations";

// TODO(auth): wire an OIDC provider (Auth0 / Clerk / Keycloak per FRD §8.2) and
// resolve the signed-in principal + role here. Until then, server actions have
// no authenticated identity and must refuse — Next server actions are reachable
// by direct POST, so authz cannot be skipped.
export async function getSessionActor(): Promise<Actor> {
  throw new Error(
    "AUTH_NOT_CONFIGURED: OIDC identity is not wired yet; server actions cannot authenticate a caller.",
  );
}

export function assertRole(actor: Actor, ...allowed: UserRole[]) {
  if (!allowed.includes(actor.role)) {
    throw new Error(`FORBIDDEN: ${actor.role} may not perform this action.`);
  }
}
