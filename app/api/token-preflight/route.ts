// app/api/token-preflight/route.ts
import { NextRequest } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { RT_COOKIE } from "@/lib/auth/serverAuth";
import { requireAuth, successResponse, errorResponse } from "@/lib/api/routeHelpers";

export const dynamic = "force-dynamic";

interface TokenPreflightBody {
  fabric_access_token?: string;
  onelake_token?: string;
  /** Never accepted from the client — always seeded from the httpOnly cookie below. */
  refresh_token?: string;
  group_id?: string;
}

/**
 * Validates the tokens a migration will need before one is started.
 *
 * Proxies `POST {SEMANTIC_KERNEL_URL}/token-preflight`. The refresh token is
 * taken from the server-held httpOnly cookie and never from the request body —
 * the same rule `app/api/migration/invoke-batch` follows — so a client cannot
 * present someone else's refresh token, and the value never enters browser
 * JavaScript.
 *
 * Returns the backend's `{ ok: false }` verdict through untouched so the caller
 * can stop and prompt for re-authentication rather than starting a run that
 * would fail partway.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const authError = requireAuth(authHeader);
  if (authError) return authError;

  let body: TokenPreflightBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  // Drop any client-supplied refresh token, then seed the server-held one.
  const { refresh_token: _ignored, ...safeBody } = body ?? {};
  const seededRt = req.cookies.get(RT_COOKIE)?.value;
  const payload = seededRt ? { ...safeBody, refresh_token: seededRt } : safeBody;

  try {
    const data = await httpClient.post<{ ok?: boolean; [key: string]: unknown }>(
      "/token-preflight",
      payload,
      { apiType: "semantic", headers: { Authorization: authHeader! } },
    );
    return successResponse(data);
  } catch (err: any) {
    // Log only the status — the message may echo token material back.
    console.error("[API /api/token-preflight] Failed with status:", err?.status ?? "unknown");
    return errorResponse(
      "Unable to verify your session. Please sign in again and retry.",
      err?.status || 502,
    );
  }
}
