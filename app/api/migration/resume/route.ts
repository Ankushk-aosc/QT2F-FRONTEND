import { NextRequest, NextResponse } from "next/server";
import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";

export const dynamic = 'force-dynamic';

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

        const semanticBase = process.env.SEMANTIC_KERNEL_URL;
        if (!semanticBase) {
            throw new Error("SEMANTIC_KERNEL_URL is not defined");
        }

        const baseUrl = semanticBase.replace(/\/$/, "");
        // Semantic Kernel namespaces this under /qlik; a bare /resume-run 404s.
        const targetUrl = `${baseUrl}/qlik/resume-run`;

        console.log(`[API /api/migration/resume] Resuming run: ${run_id}`);
        
        // Payload format requested by user: { "run_id": ["<id>"], "response": "continue", ...tokens }
        const payload = {
            run_id: Array.isArray(run_id) ? run_id : [run_id],
            response: "continue",
            fabric_access_token,
            onelake_token
        };

        const response = await fetchWithAuth(targetUrl, authHeader, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        return NextResponse.json(response, { status: 200 });
    } catch (err: any) {
        console.error("[API /api/migration/resume] Error:", err.message);
        return NextResponse.json(
            { error: "Failed to resume migration", details: err.message },
            { status: 500 }
        );
    }
}
