import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolvedIdentity = { userId: string; role: UserRole; active: boolean } | null;

// Maps an Auth0 identity to our User row — the source of truth for role (we no
// longer read roles from a token claim). Matches by authId (the Auth0 sub);
// on first login it falls back to a null-authId row with the same email and
// claims it by stamping the sub, so seeded/admin-created rows link automatically.
// A row already bound to a different sub is left alone (returns null, no hijack).
export async function resolveIdentity(sub: string, email?: string | null): Promise<ResolvedIdentity> {
  const byAuthId = await prisma.user.findUnique({ where: { authId: sub } });
  if (byAuthId) return pick(byAuthId);

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && byEmail.authId == null) {
      const linked = await prisma.user.update({ where: { id: byEmail.id }, data: { authId: sub } });
      return pick(linked);
    }
  }
  return null;
}

function pick(u: { id: string; role: UserRole; active: boolean }): ResolvedIdentity {
  return { userId: u.id, role: u.role, active: u.active };
}
