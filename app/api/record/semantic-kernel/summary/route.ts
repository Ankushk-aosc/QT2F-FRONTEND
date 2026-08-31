// Proxy for the portfolio-wide run summary the Monitoring tab's KPI cards
// read. Sibling of ../route.ts (the run-record list), same upstream host and
// apiType, different path segment.
//
// Verified live against the OpenAPI schema at
// GET /api/records/semantic-kernel/summary?email_id=... :
//   { email_id, total_runs, total_apps, apps_with_generation_completed,
//     apps_with_fully_migrated, apps_that_ran_till_parsing, total_failed,
//     in_progress, total_cancelled, total_validation_skipped }
import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

const UPSTREAM_PATH = "/api/records/semantic-kernel/summary";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email_id = searchParams.get("email_id");

    if (!email_id) {
      return NextResponse.json({ error: "email_id is required" }, { status: 400 });
    }

    const query = new URLSearchParams({ email_id });

    // apiType "logs" resolves to API_BASE_URL, the Cosmos-backed records host.
    const data = await httpClient.get<any>(`${UPSTREAM_PATH}?${query.toString()}`, {
      apiType: "logs",
    });

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/record/semantic-kernel/summary] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch migration summary", details: err.message },
      { status: err.status || 500 }
    );
  }
}
