// app/api/auth/callback/route.ts
// Server-side redirect target (registered as a Web platform URI in Entra) for the
// confidential-client auth-code flow. Exchanges the authorization code for tokens
// — including a refresh_token — and stores the RT in an httpOnly cookie so it can
// be forwarded to Semantic Kernel on run start (Strategy 0 for long runs).
import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  CALLBACK_PATH,
  OAUTH_RETURN_COOKIE,
  OAUTH_STATE_COOKIE,
  RT_COOKIE,
  RT_PRESENT_COOKIE,
  resolveBaseUrl,
  seedScopes,
  tokenEndpoint,
} from "@/lib/auth/serverAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const env = getEnv();
  const baseUrl = await resolveBaseUrl();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const oauthErrorDesc = req.nextUrl.searchParams.get("error_description");

  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(OAUTH_RETURN_COOKIE)?.value || "/dashboard";

  const clearTransient = (res: NextResponse) => {
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(OAUTH_RETURN_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (oauthError) {
    console.error(`[auth/callback] OAuth error: ${oauthError} - ${oauthErrorDesc}`);
    return clearTransient(
      NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=oauth_error`)
    );
  }

  if (!code || !state || !stateCookie || state !== stateCookie) {
    console.error("[auth/callback] Missing code or state/CSRF mismatch");
    return clearTransient(
      NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=state_mismatch`)
    );
  }

  if (!env.MSAL_CLIENT_SECRET) {
    return clearTransient(
      NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=no_secret`)
    );
  }

  try {
    const redirectUri = `${baseUrl}${CALLBACK_PATH}`;
    const form = new URLSearchParams({
      client_id: env.MSAL_CLIENT_ID,
      client_secret: env.MSAL_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      scope: seedScopes(),
    });

    const tokenRes = await fetch(tokenEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      console.error(
        `[auth/callback] Token exchange failed (${tokenRes.status}): ${data.error || ""} ${data.error_description || ""}`
      );
      return clearTransient(
        NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=exchange_failed`)
      );
    }

    const res = clearTransient(
      NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=1`)
    );

    // RT is sensitive: httpOnly + secure. Lifetime capped to cover long runs;
    // Entra RTs typically outlive this and rotate on use.
    const maxAge = 60 * 60 * 12; // 12h
    res.cookies.set(RT_COOKIE, data.refresh_token, {
      httpOnly: true,
      secure: baseUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // JS-readable companion flag (NOT the token) so the client can tell whether
    // an RT is already seeded and skip re-triggering the auto-seed redirect.
    res.cookies.set(RT_PRESENT_COOKIE, "1", {
      httpOnly: false,
      secure: baseUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    return res;
  } catch (err: any) {
    console.error("[auth/callback] Unexpected error", err);
    return clearTransient(
      NextResponse.redirect(`${baseUrl}${returnTo}?rt_seeded=0&reason=exception`)
    );
  }
}
