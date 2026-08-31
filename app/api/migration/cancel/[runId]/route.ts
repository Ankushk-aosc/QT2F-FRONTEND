import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const authHeader = req.headers.get("Authorization");

    if (!runId?.trim()) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await httpClient.post(`/cancel/${runId}`, null, { apiType: "semantic" });
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/migration/cancel] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
