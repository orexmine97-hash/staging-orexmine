"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { AuthError, STAFF_ROLES } from "@/lib/auth";
import { authorizeFor, logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  ManagementError,
  createAuth0User,
  createInviteTicket,
  isMgmtConfigured,
  setAuth0UserBlocked,
} from "@/lib/auth0-management";

export type ActionResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

function toFailure(e: unknown): { ok: false; code: string; message: string } {
  if (e instanceof AuthError || e instanceof ManagementError) {
    return { ok: false, code: e.code, message: e.message };
  }
  if (e instanceof Error && e.message.startsWith("FORBIDDEN")) {
    return { ok: false, code: "FORBIDDEN", message: e.message };
  }
  throw e;
}

const STAFF = new Set<string>(STAFF_ROLES);

// System Administrator provisions a staff account and gets back an invite link
// to send (FR-75, §5). Auth0 owns the credential; our User row owns the role.
export async function createUserAction(formData: FormData): Promise<ActionResult<{ inviteUrl: string }>> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  try {
    const actor = await authorizeFor({ action: "user.create", recordType: "User", recordId: email }, "ADMIN");

    if (!email || !name) return { ok: false, code: "INVALID", message: "Name and email are required." };
    if (!STAFF.has(role)) return { ok: false, code: "INVALID", message: "Pick a valid staff role." };
    if (!isMgmtConfigured) {
      return { ok: false, code: "MGMT_NOT_CONFIGURED", message: "Auth0 Management API is not configured — see AUTH0_MGMT_* env vars." };
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return { ok: false, code: "EXISTS", message: "A user with that email already exists." };
    }
    const org = await prisma.organization.findFirst({ where: { type: "OREXMINE" } });
    if (!org) return { ok: false, code: "NO_ORG", message: "No OREXMINE organization found — seed the database first." };

    const { userId: authId } = await createAuth0User(email, name);
    await prisma.user.create({
      data: { organizationId: org.id, email, name, role: role as UserRole, authId },
    });
    const inviteUrl = await createInviteTicket(authId);

    await logAudit(actor, "user.create", "User", authId, { after: `${role} ${email}` });
    revalidatePath("/console/administration");
    return { ok: true, inviteUrl };
  } catch (e) {
    return toFailure(e);
  }
}

export async function updateUserRoleAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  try {
    const actor = await authorizeFor({ action: "user.role", recordType: "User", recordId: userId }, "ADMIN");
    if (!STAFF.has(role)) return { ok: false, code: "INVALID", message: "Pick a valid staff role." };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found." };
    if (user.role === role) return { ok: true };

    await prisma.user.update({ where: { id: userId }, data: { role: role as UserRole } });
    await logAudit(actor, "user.role", "User", user.authId ?? userId, { before: user.role, after: role });
    revalidatePath("/console/administration");
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}

// Deactivate also blocks the Auth0 account so access ends immediately, not just
// on the next session refresh (the session-cached role would otherwise linger).
export async function setUserActiveAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  try {
    const actor = await authorizeFor({ action: "user.active", recordType: "User", recordId: userId }, "ADMIN");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found." };
    if (user.authId === actor.id) {
      return { ok: false, code: "SELF", message: "You can't change your own access." };
    }

    await prisma.user.update({ where: { id: userId }, data: { active } });
    if (user.authId && isMgmtConfigured) await setAuth0UserBlocked(user.authId, !active);
    await logAudit(actor, "user.active", "User", user.authId ?? userId, { after: active ? "active" : "deactivated" });
    revalidatePath("/console/administration");
    return { ok: true };
  } catch (e) {
    return toFailure(e);
  }
}
