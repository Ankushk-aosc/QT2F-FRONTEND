import { NextRequest, NextResponse } from "next/server";
import { getRecordsApiBaseUrl } from "@/lib/recordsApiBaseUrl";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

/**
 * Saved Qlik source connections.
 *
 *   GET  /api/qlik/connections  -> list (secrets never returned)
 *   POST /api/qlik/connections  -> create
 *
 * Proxies {NEXT_PUBLIC_RECORDS_API_BASE_URL}/qlik -- the Cosmos-backed records
 * host, not the Qlik data API. This used to target getQlikApiBaseUrl() +
 * "/connections", a path that does not exist on that host: the real
 * credential store (env_type, connection_name, qlik_tenant_url, api_key,
 * connection_id like "conn-85ae289a4110") lives at {records host}/qlik, the
 * same resource app/api/qlik-url already reads/writes in the older
 * single-URL shape. See lib/recordsApiBaseUrl.ts.
 *
 * Proxied rather than called from the browser so the Authorization bearer is
 * attached in one place, matching every other route under app/api.
 */

function qlikBase(): string {
  return getRecordsApiBaseUrl();
}

/** Reads an upstream failure body as text, preferring compact JSON when it parses. */
async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      // Not JSON -- a gateway timeout page, for instance. Keep the raw text.
      return text;
    }
  } catch (err) {
    return `Could not read error response: ${err}`;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    const envType = req.nextUrl.searchParams.get("env_type") || "";
    const query = envType ? `?env_type=${encodeURIComponent(envType)}` : "";

    // 1. Primary: Use Semantic Kernel with direct MongoDB Atlas persistence
    try {
      const skUrl = `/qlik/connections${query}`;
      const data = await httpClient.get<any>(skUrl, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (Array.isArray(data)) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn("[GET /api/qlik/connections] SK route warning:", skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const base = qlikBase();
    if (base) {
      const fullUrl = `${base}/qlik${query}`;
      const backendResponse = await fetch(fullUrl, {
        method: "GET",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (backendResponse.ok) {
        return NextResponse.json(await backendResponse.json(), { status: 200 });
      }
    }

    return NextResponse.json([], { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/qlik/connections] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (body.api_key) {
      const base = qlikBase();
      if (base) {
        try {
          await fetch(`${base}/secrets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "default_qlik_tenant-api-key",
              value: body.api_key,
              description: "Qlik API Key"
            })
          });
        } catch (e) {
          console.warn("[POST /api/qlik/connections] Failed to push api_key to secrets DB:", e);
        }
      } else {
        console.warn("[POST /api/qlik/connections] Records API base URL not configured; skipping secrets push");
      }
    }

    // 1. Primary: Save directly in MongoDB via Semantic Kernel
    try {
      const data = await httpClient.post<any>("/qlik/connections", body, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn("[POST /api/qlik/connections] SK route warning, trying fallback:", skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const base = qlikBase();
    if (base) {
      const fullUrl = `${base}/qlik`;
      const backendResponse = await fetch(fullUrl, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (backendResponse.ok) {
        return NextResponse.json(await backendResponse.json(), { status: 200 });
      }
      const details = await readError(backendResponse);
      return NextResponse.json({ error: "Backend request failed", details }, { status: backendResponse.status });
    }

    return NextResponse.json({ error: "No backend available to save connection" }, { status: 500 });
  } catch (err: any) {
    console.error("[POST /api/qlik/connections] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}
