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
    const folderName = searchParams.get("folderName");
    const agentName = searchParams.get("agentName");

    if (!folderName || !agentName) {
      return NextResponse.json({ error: "Missing folderName or agentName parameters" }, { status: 400 });
    }

    const data = await httpClient.get<any>(
      `/agent-actions/${folderName}?agent_name=${agentName}`,
      {
        apiType: "sql",
        headers: { Authorization: authHeader },
      }
    );
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/agent-actions] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch agent actions" }, { status });
  }
}
