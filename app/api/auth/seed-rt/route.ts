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

  if (!env.MSAL_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "MSAL_CLIENT_SECRET is not configured; cannot seed refresh_token." },
      { status: 500 }
    );
  }

  const baseUrl = await resolveBaseUrl();
  const redirectUri = `${baseUrl}${CALLBACK_PATH}`;
  const state = randomBytes(24).toString("hex");

  // Where to send the user after the RT is seeded (default dashboard).
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/dashboard";
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
