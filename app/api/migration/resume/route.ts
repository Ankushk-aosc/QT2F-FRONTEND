import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized: Missing Authorization header" }, { status: 401 });
    }

    const body = await req.json();
    const { run_id, fabric_access_token, onelake_token } = body;

    if (!run_id) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    const payload = {
      run_id: Array.isArray(run_id) ? run_id : [run_id],
      response: "continue",
      fabric_access_token,
      onelake_token,
    };

    const data = await httpClient.post("/resume-run", payload, { apiType: "semantic" });
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/migration/resume] Error:", err.message);
    return NextResponse.json(
      { error: "Failed to resume migration", details: err.message },
      { status: err.status || 500 }
    );
  }
}
