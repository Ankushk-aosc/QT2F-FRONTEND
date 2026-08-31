// app/api/auth/seed-rt/route.ts
// Starts the server-side (confidential-client) auth-code flow used to obtain a
// refresh_token for long-running Fabric/OneLake token renewal. Redirects the
// browser to Entra's authorize endpoint using the registered Web redirect URI.
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getEnv } from "@/lib/env";
import {
  CALLBACK_PATH,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  authorizeEndpoint,
  resolveBaseUrl,
  seedScopes,
} from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const env = getEnv();
  const baseUrl = await resolveBaseUrl();

  // Where to send the user after the RT is seeded (default dashboard).
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard";

  if (!env.MSAL_CLIENT_SECRET) {
    // Same graceful-degradation pattern as /api/auth/callback: bounce the
    // user back into the app instead of stranding them on a raw JSON error.
    // RT-seeding (Semantic Kernel long-run token renewal) just stays off.
    console.warn("[auth/seed-rt] MSAL_CLIENT_SECRET not configured; skipping refresh_token seed.");
    return NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=no_secret`);
  }

  const redirectUri = `${baseUrl}${CALLBACK_PATH}`;
  const state = randomBytes(24).toString("hex");
  const loginHint = req.nextUrl.searchParams.get("login_hint") || undefined;

  const params = new URLSearchParams({
    client_id: env.MSAL_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: seedScopes(),
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);

  const res = NextResponse.redirect(`${authorizeEndpoint()}?${params.toString()}`);

  const secure = baseUrl.startsWith("https://");
  const cookieOpts = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 min — only needs to survive the redirect round-trip
  };
  res.cookies.set(OAUTH_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(OAUTH_RETURN_COOKIE, returnTo, cookieOpts);

  return res;
}
