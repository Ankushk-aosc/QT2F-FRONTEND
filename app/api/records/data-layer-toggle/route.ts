// app/api/records/data-layer-toggle/route.ts
import { NextResponse } from "next/server";
import { relayUpstreamError } from "@/lib/api/routeHelpers";
import { getEnv } from "@/lib/env";

const getBaseUrl = () => {
  const apiBaseUrl = getEnv().API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("[Env] Missing required environment variable: API_BASE_URL");
  }
  return `${apiBaseUrl.replace(/\/$/, "")}/allow-data-agent-to-run`;
};
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    const response = await fetch(baseUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { "Authorization": authHeader } : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ allow_data_agent: false });
      }
      return NextResponse.json({ allow_data_agent: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[API data-layer-toggle] GET Error:", error);
    return NextResponse.json({ allow_data_agent: false });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("Authorization");
    const baseUrl = getBaseUrl();
    console.log("[API data-layer-toggle] Patching Body:", JSON.stringify(body));

    // Retry logic for intermittent backend timeouts
    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = attempt * 2000; // 2s, 4s backoff
          console.log(`[API data-layer-toggle] Retry attempt ${attempt}/${MAX_RETRIES} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }

        const response = await fetch(baseUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { "Authorization": authHeader } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000), // 15s timeout per attempt
        });

        if (!response.ok) {
      return relayUpstreamError("[API /api/records/data-layer-toggle]", baseUrl, response);
    }

        const data = await response.json();
        return NextResponse.json(data);
      } catch (err: any) {
        lastError = err;
        const isTimeout = err.message?.includes('timeout') || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed');
        if (!isTimeout || attempt >= MAX_RETRIES) {
          throw err;
        }
        console.warn(`[API data-layer-toggle] PATCH attempt ${attempt + 1} failed: ${err.message?.slice(0, 80)}`);
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("[API data-layer-toggle] PATCH Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
