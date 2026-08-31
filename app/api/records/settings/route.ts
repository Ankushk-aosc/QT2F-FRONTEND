import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  // The Container Apps backend has no /records/settings endpoint; the only
  // setting this route's single caller (ui.store's fetchTimezone) reads is the
  // timezone, which now lives here. Returns {"timezone":"..."}, which
  // fetchTimezone already handles via its `data?.timezone` branch.
  return `${apiBaseUrl.replace(/\/$/, "")}/api/records/timezone`;
};

export const dynamic = "force-dynamic";

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
      // ui.store treats a missing value as "nothing stored" and keeps the
      // browser-detected zone, so answer with an empty setting rather than an
      // error -- throwing here aborted fetchTimezone before its sync step and
      // logged a failure on a healthy first run.
      if (response.status === 404) {
        return NextResponse.json({ timezone: null }, { status: 200 });
      }

      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // body already consumed or empty
      }
      // Preserve the upstream status instead of reporting everything as 500.
      return NextResponse.json(
        { error: `Backend responded with ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API records/settings] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
