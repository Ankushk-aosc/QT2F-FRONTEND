import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: API_BASE_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/records/interactive-status`;
};
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log(`[TESTING /api/records/interactive-status] Fetching URL: ${baseUrl}`);
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      // Throwing here used to collapse every upstream status into a flat 500 —
      // including the backend's 404 "Interactive status not found", which is
      // simply the not-yet-configured state. Pass the real status and body
      // through instead so callers can tell the two apart.
      const details = await response.text().catch(() => "");
      console.error(
        `[API /api/records/interactive-status] GET ${baseUrl} -> ${response.status}: ${details.slice(0, 500)}`
      );
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, details },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API /api/records/interactive-status] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log("[API Records] Patching Body:", JSON.stringify(body));
    const response = await fetch(baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error(
        `[API /api/records/interactive-status] PATCH ${baseUrl} -> ${response.status}: ${details.slice(0, 500)}`
      );
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, details },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API /api/records/interactive-status] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }
}
