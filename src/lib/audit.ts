import type { UserRole } from "@prisma/client";
import { assertRole, getSessionActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/reservations";

type Record = { action: string; recordType: string; recordId: string };

/**
 * Authenticate + authorize a privileged action, recording an AuditEvent when a
 * signed-in staff member is denied by role (NFR-08). Anonymous / no-role
 * attempts throw in getSessionActor before we have an actor to attribute, so
 * they aren't written here — the proxy already turns those away for reads.
 * ponytail: audits role denials only; no-actor denials rely on proxy + returned error.
 */
export async function authorizeFor(record: Record, ...allowed: UserRole[]): Promise<Actor> {
  const actor = await getSessionActor();
  try {
    assertRole(actor, ...allowed);
  } catch (e) {
    await logDenied(actor, `${record.action}.denied`, record.recordType, record.recordId);
    throw e;
  }
  return actor;
}

export async function logDenied(actor: Actor, action: string, recordType: string, recordId: string) {
  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      recordType,
      recordId,
      reason: "permission denied",
    },
  });
}
