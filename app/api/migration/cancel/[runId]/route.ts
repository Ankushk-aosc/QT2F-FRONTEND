import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

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

        // Semantic Kernel has no /cancel/{run_id}; cancelling a whole run is
        // what /qlik/stop-run does, and it takes the id in the body.
        const data = await httpClient.post<{ success: boolean; message: string }>(
            "/qlik/stop-run",
            { run_id: runId },
            { apiType: "semantic", headers: { Authorization: authHeader } }
        );
        return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
        console.error("[API /api/migration/cancel] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
}
