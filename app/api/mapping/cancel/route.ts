import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        if (!req.headers.get("Authorization")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: any = {};
        try {
            body = await req.json();
        } catch { }

        const targetRunId = body.run_id;

        if (!targetRunId) {
            return NextResponse.json({ error: "run_id required" }, { status: 400 });
        }

        // See /api/assessment/cancel: no per-stage cancel exists upstream.
        console.warn(
            `[API /api/mapping/cancel] No per-stage cancel exists for run ${targetRunId} — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Cancelling the mapping stage on its own is not supported.",
                details:
                    "Semantic Kernel exposes only a whole-run stop. Use POST /api/migration/cancel/{runId} to cancel the entire run.",
            },
            { status: 501 }
        );
    } catch (err: any) {
        console.error("[API /api/mapping/cancel POST] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
