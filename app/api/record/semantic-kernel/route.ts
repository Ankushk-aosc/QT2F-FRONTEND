import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

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
    query.set("page_size", page_size);
    query.set("pageSize", page_size);

    // Optional filters
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const created_on = searchParams.get("created_on");
    const created_from = searchParams.get("created_from");
    const created_to = searchParams.get("created_to");

    if (status) query.set("status", status);
    if (search) query.set("search", search);
    if (created_on) query.set("created_on", created_on);
    if (created_from) query.set("created_from", created_from);
    if (created_to) query.set("created_to", created_to);

    const data = await httpClient.get<any[]>(
      `/records/semantic-kernel?${query.toString()}`,
      { apiType: "logs" } 
    );



    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/record/semantic-kernel] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch run history", details: err.message },
      { status: err.status || 500 }
    );
  }
}
