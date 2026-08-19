import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        if (!req.headers.get("Authorization")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const runId = req.url.split("/").pop(); // This might be 'cancel' if not parameterized
        // We expect run_id in the body for a clean POST
        let body: any = {};
        try {
            body = await req.json();
        } catch { }

        const targetRunId = body.run_id;

        if (!targetRunId) {
            return NextResponse.json({ error: "run_id required" }, { status: 400 });
        }

        // Semantic Kernel offers no per-stage cancel — only /qlik/stop-run,
        // which aborts the entire run. Silently escalating a "cancel
        // assessment" into "stop everything" would be worse than saying no.
        console.warn(
            `[API /api/assessment/cancel] No per-stage cancel exists for run ${targetRunId} — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Cancelling the assessment stage on its own is not supported.",
                details:
                    "Semantic Kernel exposes only a whole-run stop. Use POST /api/migration/cancel/{runId} to cancel the entire run.",
            },
            { status: 501 }
        );
    } catch (err: any) {
        console.error("[API /api/assessment/cancel POST] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
