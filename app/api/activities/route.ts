// app/api/activities/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-handler";
import { validateTokenAudience } from "@/lib/token-validation";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // â”€â”€ Query parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const run_id = searchParams.get("run_id");
    const agent_name = searchParams.get("agent_name");
    const workbook_id = searchParams.get("workbook_id");

    // Optional
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const from_timestamp = searchParams.get("from_timestamp");
    const to_timestamp = searchParams.get("to_timestamp");

    // â”€â”€ Authorization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[API activities] Missing Authorization header");
      return NextResponse.json(
        { error: "Unauthorized: Missing Authorization header" },
        { status: 401 }
      );
    }

    // â”€â”€ Required parameters validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (!project_id || !run_id || !agent_name || !workbook_id) {
      console.error("[API activities] Missing required parameters", {
        project_id,
        run_id,
        agent_name,
        workbook_id,
      });
      return NextResponse.json(
        { error: "Missing required fields: project_id, run_id, agent_name, workbook_id" },
        { status: 400 }
      );
    }

    // Optional token audience check (continues even if invalid)
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!validateTokenAudience(token)) {
      console.warn("[API activities] Invalid token audience â€“ proceeding anyway");
    }

    // â”€â”€ Build target URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const logsBase = process.env.LOGS_API_BASE;
    if (!logsBase) {
      console.error("[API activities] LOGS_API_BASE is not defined in environment");
      return NextResponse.json(
        { error: "Server configuration error: LOGS_API_BASE missing" },
        { status: 500 }
      );
    }

    const baseUrl = logsBase.replace(/\/$/, "");           // remove trailing slash if any
    const targetUrl = new URL(`${baseUrl}/activities`);    // â† this gives /api/records/activities

    // Forward all relevant query parameters
    targetUrl.searchParams.append("project_id", project_id);
    targetUrl.searchParams.append("run_id", run_id);
    targetUrl.searchParams.append("agent_name", agent_name);
    targetUrl.searchParams.append("workbook_id", workbook_id);

    if (limit) targetUrl.searchParams.append("limit", limit);
    if (offset) targetUrl.searchParams.append("offset", offset);
    if (from_timestamp) targetUrl.searchParams.append("from_timestamp", from_timestamp);
    if (to_timestamp) targetUrl.searchParams.append("to_timestamp", to_timestamp);

    console.log(`[API activities] Forwarding to: ${targetUrl.toString()}`);

    // â”€â”€ Proxy request to backend (with timeout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response: Response;
    try {
      response = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      // â˜… Network error (DNS, connection refused, timeout)
      const reason = fetchErr.name === 'AbortError' ? 'Request timed out (30s)' : fetchErr.message || 'fetch failed';
      console.warn(`[API activities] Backend unreachable: ${reason}`);
      return NextResponse.json(
        { error: "Backend unreachable", details: reason },
        { status: 503 }  // â˜… 503 Service Unavailable (not 500)
      );
    }
    clearTimeout(timeout);

    console.log(`[API activities] Backend responded with status ${response.status}`);

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
        console.error("[API activities] Backend error:", errorBody.substring(0, 800));
      } catch { }

      return NextResponse.json(
        {
          error: `Backend returned ${response.status}`,
          status: response.status,
          details: errorBody || "No details available",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    console.error("[API activities] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch agent activities",
        details: getErrorMessage(err),
      },
      { status: 500 }
    );
  }
}
