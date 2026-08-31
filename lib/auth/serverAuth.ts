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
 * Resolve the externally reachable base URL (protocol + host) of THIS app — not
 * of any backend service. Used to build the OAuth redirect_uri, so it must match
 * a Web redirect URI registered in Entra.
 *
 * APP_URL wins when set (pin it when the public URL differs from what the app
 * sees, e.g. behind a CDN). Otherwise it is derived from the request, which is
 * correct in every environment — localhost in dev, the container host in Docker,
 * the forwarded host behind Azure's proxy — with no URL hardcoded in source.
 *
 * The single source of truth for this: /api/auth/config calls it too, so the
 * browser-side redirectUri and the server-side redirect_uri cannot drift apart.
 */
export async function resolveBaseUrl(): Promise<string> {
  const configured = getEnv().APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host = h.get("x-forwarded-host") || h.get("host");

  if (!host) {
    throw new Error(
      "[Env] Cannot resolve this app's base URL: APP_URL is unset and the request " +
        "carries no X-Forwarded-Host or Host header. Set APP_URL to the app's public URL."
    );
  }

  return `${proto}://${host}`.replace(/\/$/, "");
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
