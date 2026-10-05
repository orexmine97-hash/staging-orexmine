import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import { resolveIdentity } from "@/lib/user-role";

// Auth0 is optional: with no domain/secret configured the app runs read-only
// (public showcase + console) instead of the middleware crashing every route.
// Sign-in and the reserve/QC mutations light up once these are set.
export const isAuthConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_SECRET);

// Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET and
// APP_BASE_URL from the environment. The SDK mounts /auth/* via proxy.ts.
export const auth0 = new Auth0Client({
  // The role is OURS, not Auth0's: on session save we look the signed-in user up
  // in the DB (source of truth) and stamp role/active/userId onto the session, so
  // proxy.ts and getSessionActor() read them without a per-request DB hit. Auth0
  // only proves identity. This runs on Next 16's Node.js proxy runtime, so Prisma
  // is available here. Default claims are still trimmed via filterDefaultIdTokenClaims.
  async beforeSessionSaved(session) {
    const claims = session.user as Record<string, unknown>;
    const user = filterDefaultIdTokenClaims(claims) as Record<string, unknown>;
    const identity = await resolveIdentity(String(claims.sub), (claims.email as string) ?? null);
    if (identity) {
      user.userId = identity.userId;
      user.role = identity.role;
      user.active = identity.active;
    }
    return { ...session, user: user as typeof session.user };
  },
});
