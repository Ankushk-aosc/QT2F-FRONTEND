import { NextRequest, NextResponse } from "next/server";

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

    // No backend serves a folder-scoped agent-action read. The Qlik migration
    // store exposes only `POST /agent-actions` (verified: GET
    // /agent-actions/{folder} is 404, and the collection itself is 405 on GET).
    // The equivalent read is `/api/activities`, but it is keyed by
    // project_id + run_id + workbook_id + agent_name rather than by folder, so
    // it is not a drop-in substitute for this contract. Say so rather than
    // returning a misleading 500 or an invented empty list.
    console.warn(
      `[API /api/qlik/agent-actions] No backend route for folder="${folderName}" agent="${agentName}" — returning 501.`
    );
    return NextResponse.json(
      {
        error: "Agent action history by folder is not available.",
        details:
          "No backend exposes a folder-scoped agent-action read. Use /api/activities with project_id, run_id, workbook_id and agent_name instead.",
      },
      { status: 501 }
    );
  } catch (err: any) {
    console.error("[API /api/qlik/agent-actions] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch agent actions" }, { status });
  }
}
