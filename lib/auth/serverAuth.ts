import "server-only";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";

// httpOnly cookie that holds the MSAL refresh_token seeded via the server-side
// auth-code flow. Forwarded to Semantic Kernel on run start so Strategy 0 can
// renew Fabric/OneLake tokens during long (~2h) runs without OBO.
export const RT_COOKIE = "t2f_rt";
// JS-readable flag (not the token) indicating an RT is currently seeded.
export const RT_PRESENT_COOKIE = "t2f_rt_present";
// Short-lived cookie guarding the auth-code request against CSRF.
export const OAUTH_STATE_COOKIE = "t2f_oauth_state";
// Optional cookie carrying the post-login return path.
export const OAUTH_RETURN_COOKIE = "t2f_oauth_return";

// The server-side flow uses the Web redirect URI registered in Entra.
export const CALLBACK_PATH = "/api/auth/callback";

/**
 * Resolve the externally reachable base URL (protocol + host), mirroring
 * /api/auth/config so the redirect_uri exactly matches a registered Web URI.
 */
export async function resolveBaseUrl(): Promise<string> {
  const env = getEnv();
  let baseUrl = env.APP_URL;

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const host = h.get("host");

  if (env.APP_URL === "http://localhost:3000" && (forwardedHost || host)) {
    const proto = h.get("x-forwarded-proto") || "http";
    baseUrl = `${proto}://${forwardedHost || host}`;
  }
  return baseUrl.replace(/\/$/, "");
}

function normalizedAuthority(): string {
  return getEnv().MSAL_AUTHORITY.replace(/\/$/, "");
}

export function authorizeEndpoint(): string {
  return `${normalizedAuthority()}/oauth2/v2.0/authorize`;
}

export function tokenEndpoint(): string {
  return `${normalizedAuthority()}/oauth2/v2.0/token`;
}

/**
 * Scopes for the auth-code request. The returned refresh_token is NOT
 * resource-bound, so SK can redeem it for Fabric/Storage later. We request the
 * backend API scope here (yields an appidacr=1 access token) plus offline_access.
 */
export function seedScopes(): string {
  const env = getEnv();
  return ["offline_access", "openid", "profile", env.API_SCOPE].join(" ");
}
