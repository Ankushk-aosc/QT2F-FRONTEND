import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export async function GET(
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

        const data = await httpClient.get<unknown>(
            `/status/${runId}`,
            { apiType: "semantic" } // httpClient automatically forwards headers from context if not available manually? 
            // Wait, httpClient implementation:
            // if (forwardHeaders) { const headerStore = await headers(); ... }
            // Since this is a Route Handler, `headers()` works.
            // But we already checked `req.headers`.
            // The `httpClient` will automatically pick up Authorization header from request context via `next/headers`.
            // BUT passing it explicitly is safer/clearer since we already have it.
            // However, `httpClient` options supports `headers` but NOT strictly 'Authorization' as a named prop in the same way `httpGet` did.
            // We can rely on automatic forwarding OR pass it in options.headers.
            // Let's rely on auto forwarding as it's cleaner.
        );

        return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
        console.error("[API /api/migration/status] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
