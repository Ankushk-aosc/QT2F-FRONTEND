// app/api/records/timezone/route.ts
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

/**
 * Unified GET+PATCH route for the Q2F records API's dedicated timezone
 * resource -- `{apiBaseUrl}/api/records/timezone`, confirmed live: GET
 * returns `{"timezone":"Asia/Calcutta"}` and PATCH `{"timezone":"..."}`
 * returns `{"id":"timezone","key":"timezone","value":"...","updated_at":...,
 * "type":"setting"}`. Mirrors deployment_type/route.ts's shape (same
 * describeError helper, same auth passthrough), which is the one other
 * settings resource on this backend.
 *
 * Replaces the previous split across app/api/records/settings/route.ts (GET)
 * and app/api/records/settings/timezone/route.ts (PATCH) -- both of those
 * already proxied to this exact backend path internally (their own comments
 * said so), just under Next.js route names left over from T2F's `/settings`
 * shape, which does not exist on this backend at all. Same behaviour, one
 * route, a name that matches what it actually calls.
 */
const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  return `${apiBaseUrl.replace(/\/$/, "")}/api/records/timezone`;
};

export const dynamic = "force-dynamic";

/**
 * Node's fetch reports every transport failure as the bare string "fetch failed"
 * and hides the real reason (DNS miss, refused connection, TLS error, timeout)
 * on `error.cause`. Returning just the message makes an unreachable backend
 * indistinguishable from a bug in this route, so unwrap the cause.
 */
function describeError(error: any): string {
  const cause = error?.cause;
  if (!cause) return error?.message ?? String(error);
  const detail = [cause.code, cause.syscall, cause.hostname, cause.message]
    .filter(Boolean)
    .join(" ");
  return `${error.message}: ${detail}`;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // 404 "Timezone not found" just means this user has never saved one.
      // ui.store treats a missing value as "nothing stored yet" and keeps the
      // browser-detected zone, so answer with an empty setting rather than an
      // error -- throwing here would abort fetchTimezone before its sync step
      // and log a failure on a perfectly healthy first run.
      if (response.status === 404) {
        return NextResponse.json({ timezone: null }, { status: 200 });
      }

      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // body already consumed or empty
      }
      return NextResponse.json(
        { error: `Backend responded with ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API records/timezone] GET Error:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();

    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // ignore
      }

      // PATCH updates an existing record, so a user who has never saved a
      // timezone gets 404 "Timezone not found". That is the first-run state,
      // not a failure: ui.store has already set the browser-detected zone
      // locally and is only syncing it back, so report a no-op rather than
      // surfacing "Backend responded with 404" on a healthy session.
      if (response.status === 404) {
        console.info("[API records/timezone] No stored timezone for this user yet; skipping sync.");
        return NextResponse.json(
          { timezone: body?.timezone ?? null, persisted: false },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: `Backend responded with ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API records/timezone] PATCH Error:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}
