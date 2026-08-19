import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // The records API exposes run history at /api/records/run-history and
    // requires `email_id` (it 422s without it). There is no
    // /run-history/by-email/{email} route on any backend — that path 404'd.
    // The frontend contract keeps its `email` param; translate it here.
    const query = new URLSearchParams({ email_id: email });
    for (const [key, value] of searchParams.entries()) {
      if (key === "email") continue;
      // `limit` is this route's public name for the backend's `page_size`.
      query.set(key === "limit" ? "page_size" : key, value);
    }

    const data = await httpClient.get<any>(`/records/run-history?${query.toString()}`, {
      apiType: "logs",
      headers: { Authorization: authHeader },
    });
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/history] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch run history" }, { status });
  }
}
