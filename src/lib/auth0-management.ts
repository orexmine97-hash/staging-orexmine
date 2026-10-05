// Thin Auth0 Management API client — just the calls the admin Users screen needs:
// create an account, mint a set-password invite link, and block/unblock. Uses a
// dedicated M2M app (not the web-login client, which isn't authorized for the
// Management API). We hand-roll fetch rather than pull in the `auth0` node SDK:
// three endpoints don't justify the dependency.
//
// ponytail: module-level token cache (one server instance); fine at MVP scale.
// A shared cache (Redis) only matters with many instances hammering /oauth/token.

const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;
const CONNECTION = process.env.AUTH0_DB_CONNECTION || "Username-Password-Authentication";
const BASE_URL = process.env.APP_BASE_URL || "";

export const isMgmtConfigured = Boolean(DOMAIN && CLIENT_ID && CLIENT_SECRET);

export class ManagementError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ManagementError";
  }
}

let cached: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (!isMgmtConfigured) {
    throw new ManagementError("MGMT_NOT_CONFIGURED", "Auth0 Management API is not configured (set AUTH0_MGMT_CLIENT_ID / AUTH0_MGMT_CLIENT_SECRET).");
  }
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new ManagementError("MGMT_TOKEN_FAILED", data.error_description ?? "Could not authenticate to the Management API.");
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function api(path: string, init: RequestInit): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`https://${DOMAIN}/api/v2${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    const d = data as { message?: string; error?: string } | null;
    throw new ManagementError(`HTTP_${res.status}`, d?.message ?? d?.error ?? `Management API error (${res.status}).`);
  }
  return data;
}

// Creates the Auth0 account with a random password; the user sets their own via
// the invite ticket. email_verified stays false — the ticket verifies it.
export async function createAuth0User(email: string, name: string): Promise<{ userId: string }> {
  const user = (await api("/users", {
    method: "POST",
    body: JSON.stringify({
      connection: CONNECTION,
      email,
      name,
      password: cryptoRandomPassword(),
      email_verified: false,
      verify_email: false,
    }),
  })) as { user_id: string };
  return { userId: user.user_id };
}

// Set-password ("password change") ticket — the link we hand to the new user.
// mark_email_as_verified so they don't also need a separate verification step.
export async function createInviteTicket(userId: string): Promise<string> {
  const t = (await api("/tickets/password-change", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      result_url: `${BASE_URL}/auth/login`,
      mark_email_as_verified: true,
      ttl_sec: 7 * 24 * 3600,
    }),
  })) as { ticket: string };
  return t.ticket;
}

export async function setAuth0UserBlocked(userId: string, blocked: boolean): Promise<void> {
  await api(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify({ blocked }) });
}

function cryptoRandomPassword(): string {
  // Meets Auth0's default policy; never used — replaced when the user sets theirs.
  return `Aa1!${crypto.randomUUID()}${crypto.randomUUID()}`;
}
