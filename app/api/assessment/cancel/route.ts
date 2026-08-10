import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

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

        // Forward Authorization header explicitly
        const authHeader = req.headers.get("Authorization");

        const data = await httpClient.post<{ success: boolean; message: string }>(
            `/assessment/cancel/${targetRunId}`,
            null,
            {
                apiType: "semantic",
                headers: { "Authorization": authHeader! }
            }
        );

        return NextResponse.json(data);
    } catch (err: any) {
        console.error("[API /api/assessment/cancel POST] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
