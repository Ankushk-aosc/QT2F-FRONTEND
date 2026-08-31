// Proxy for the run-record list that MonitoringTab / monitoring.store read to
// find active runs. Ported from vl-t2f-frontend's app/api/record/semantic-kernel
// route; the upstream path differs because the Container Apps backend serves
// this under /api/records/... rather than the old host's bare /semantic-kernel.
//
// Verified live: GET /api/records/semantic-kernel?email_id=...&page=1&page_size=50
// returns 200 with a JSON array.
import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

const UPSTREAM_PATH = "/api/records/semantic-kernel";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email_id = searchParams.get("email_id");
    const run_id = searchParams.get("run_id");
    const page = searchParams.get("page") || "1";
    const page_size = searchParams.get("page_size") || "10";

    if (!email_id && !run_id) {
      return NextResponse.json({ error: "email_id or run_id is required" }, { status: 400 });
    }

    const query = new URLSearchParams();
    if (email_id) query.set("email_id", email_id);
    if (run_id) query.set("run_id", run_id);
    query.set("page", page);
    // Both spellings are sent because the two backend generations disagree on it.
    query.set("page_size", page_size);
    query.set("pageSize", page_size);

    // Optional filters, forwarded only when present.
    for (const key of ["status", "search", "created_on", "created_from", "created_to"]) {
      const value = searchParams.get(key);
      if (value) query.set(key, value);
    }

    // apiType "logs" resolves to API_BASE_URL, the Cosmos-backed records host.
    const data = await httpClient.get<any[]>(`${UPSTREAM_PATH}?${query.toString()}`, {
      apiType: "logs",
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/record/semantic-kernel] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch run history", details: err.message },
      { status: err.status || 500 }
    );
  }
}
