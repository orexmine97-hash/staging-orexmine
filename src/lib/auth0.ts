import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";

// Auth0 drops non-namespaced custom claims, so an Auth0 Login Action must add
// the signed-in user's staff role (a UserRole value) under this exact key.
export const ROLES_CLAIM = "https://orexmine.app/roles";

// Auth0 is optional: with no domain/secret configured the app runs read-only
// (public showcase + console) instead of the middleware crashing every route.
// Sign-in and the reserve/QC mutations light up once these are set.
export const isAuthConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_SECRET);

// Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET and
// APP_BASE_URL from the environment. The SDK mounts /auth/* via proxy.ts.
export const auth0 = new Auth0Client({
  // Without this hook the SDK strips every non-standard claim from session.user
  // (filterDefaultIdTokenClaims), which would drop the namespaced role and break
  // RBAC. Keep the default-claim trim, but preserve the role claim.
  async beforeSessionSaved(session) {
    const claims = session.user as Record<string, unknown>;
    const user = filterDefaultIdTokenClaims(claims) as Record<string, unknown>;
    if (claims[ROLES_CLAIM] !== undefined) user[ROLES_CLAIM] = claims[ROLES_CLAIM];
    return { ...session, user: user as typeof session.user };
  },
});
