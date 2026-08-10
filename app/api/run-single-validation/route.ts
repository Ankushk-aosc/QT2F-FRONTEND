import { NextRequest, NextResponse } from "next/server";
import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";

/**
 * API Proxy for re-running validation on a single workbook.
 * This route forwards the request to the Semantic Kernel backend service.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const semanticBase = process.env.SEMANTIC_KERNEL_URL;
        if (!semanticBase) {
            throw new Error("SEMANTIC_KERNEL_URL is not defined in environment variables");
        }
        const baseUrl = semanticBase.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/run-single-validation`;
        
        console.log(`[Run-Single-Validation] Proxying to: ${targetUrl}`);
        
        const payload: any = {
            email: body.email,
            run_id: body.run_id,
            project_id: body.project_id,
            workbook_id: body.workbook_id,
        };
        
        if (body.fabric_access_token && body.fabric_access_token.length > 0) {
            payload.fabric_access_token = body.fabric_access_token;
        }

        const authHeader = req.headers.get("Authorization");

        const result = await fetchWithAuth(targetUrl, authHeader, {
            method: "POST",
            body: JSON.stringify(payload),
        });

        return NextResponse.json(result, { status: 200 });

    } catch (err: any) {
        console.error(`[Revalidate-Single] Connection Error:`, err.message);
        return NextResponse.json(
            { error: `Failed to re-run validation. Details: ${err.message}` },
            { status: err.status || 500 }
        );
    }
}
