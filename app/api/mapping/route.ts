import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.toString();
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized: Missing Authorization header" }, { status: 401 });
        }

        const projectId = searchParams.get("project_id");
        const workbookId = searchParams.get("workbook_id");
        const runId = searchParams.get("run_id");

        console.log(`[API /api/mapping] Query: project=${projectId}, workbook=${workbookId}, run=${runId}`);
        console.log(`[API /api/mapping] Auth Header Present: true`);

        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            throw new Error("LOGS_API_BASE is not defined");
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/records/mapping?${query}`;

        console.log(`[API /api/mapping] Target URL: ${targetUrl}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        let response: Response;
        try {
            response = await fetch(targetUrl.toString(), {
                method: "GET",
                headers: {
                    "Authorization": authHeader,
                    "Accept": "application/json",
                },
                cache: "no-store",
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                let errorBody = "";
                try { errorBody = await response.text(); } catch { }
                return NextResponse.json(
                    { error: `Backend returned ${response.status}`, details: errorBody },
                    { status: response.status }
                );
            }

            const data = await response.json();
            return NextResponse.json(data, { status: 200 });

        } catch (fetchErr: any) {
            clearTimeout(timeout);
            // ★ Network error — backend unreachable
            const reason = fetchErr.name === 'AbortError' ? 'Request timed out (30s)' : fetchErr.message || 'fetch failed';
            console.warn(`[API /api/mapping GET] Backend unreachable: ${reason}`);
            return NextResponse.json(
                { error: "Backend unreachable", details: reason },
                { status: 503 }
            );
        }
    } catch (err: any) {
        console.error("[API /api/mapping GET] Error:", err.message);
        // ★ Preserve the original HTTP status from the backend (e.g. 404)
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to fetch mapping data" }, { status });
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!req.headers.get("Authorization")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: any;
        try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

        if (!body.user_email || !body.items?.length) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const authHeader = req.headers.get("Authorization");

        // Semantic Kernel has no /batch-mapping. Mapping runs as a stage of
        // /invoke-batch rather than as a separately orchestrated batch.
        console.warn(
            `[API /api/mapping POST] No /batch-mapping endpoint exists upstream (${body.items.length} item(s)) — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Batch mapping is not available as a standalone operation.",
                details:
                    "Semantic Kernel runs mapping as a stage of POST /api/migration/invoke-batch.",
            },
            { status: 501 }
        );
    } catch (err: any) {
        console.error("[API /api/mapping POST] Error:", err.message);
        // ★ Preserve the original HTTP status from the backend (e.g. 404)
        const status = err.status || 500;
        return NextResponse.json({ error: err.message }, { status });
    }
}
