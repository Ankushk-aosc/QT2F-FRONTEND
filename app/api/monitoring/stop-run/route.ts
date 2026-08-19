import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { run_id } = body;

        if (!run_id) {
            return NextResponse.json(
                { error: "run_id is required" },
                { status: 400 }
            );
        }

        // ── Authorization ────────────────────────────────────────────────
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json(
                { error: "Unauthorized: Missing Authorization header" },
                { status: 401 }
            );
        }

        const skUrl = process.env.SEMANTIC_KERNEL_URL;
        if (!skUrl) {
            return NextResponse.json(
                { error: "Server configuration error: SEMANTIC_KERNEL_URL missing" },
                { status: 500 }
            );
        }

        const baseUrl = skUrl.replace(/\/$/, "");
        // Semantic Kernel namespaces this under /qlik; a bare /stop-run 404s.
        const targetUrl = `${baseUrl}/qlik/stop-run`;

        console.log(`[API monitoring/stop-run] Forwarding stop run for ${run_id} to: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({ run_id }),
            cache: "no-store",
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return NextResponse.json(
                { error: `Backend returned ${response.status}`, details: errorBody },
                { status: response.status }
            );
        }

        let data = { success: true };
        try {
            data = await response.json();
        } catch (e) {
            // response might be empty or plain text
        }

        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json(
            { error: "Failed to stop run", details: getErrorMessage(err) },
            { status: 500 }
        );
    }
}
