import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized: Missing Authorization header" }, { status: 401 });
        }

        let { searchParams } = new URL(req.url);
        let projectId = searchParams.get("project_id");
        let workbookId = searchParams.get("workbook_id");
        let runId = searchParams.get("run_id");

        const query = `project_id=${projectId}&workbook_id=${workbookId}&run_id=${runId}`;

        if (!projectId || !workbookId || !runId) {
            return NextResponse.json({ error: "Missing project_id, workbook_id, or run_id" }, { status: 400 });
        }

        const logsBase = process.env.LOGS_API_BASE;
        const generationBase = process.env.GENERATION_API_URL; // Optional, similar to validation

        const candidateUrls: string[] = [];

        if (logsBase) {
            const base = logsBase.replace(/\/$/, "");
            // LOGS_API_BASE goes to .../api/records
            // Postman URL: .../api/records/generation
            candidateUrls.push(`${base}/generation?${query}`);
        }

        if (generationBase) {
            const base = generationBase.replace(/\/$/, "");
            candidateUrls.push(`${base}/generation?${query}`);
            candidateUrls.push(`${base}/api/records/generation?${query}`);
        }

        if (candidateUrls.length === 0) {
            return NextResponse.json(
                {
                    error: "Server configuration error: no backend base URL configured",
                    details: "Set LOGS_API_BASE or GENERATION_API_URL in environment"
                },
                { status: 500 }
            );
        }

        console.log(`[API /api/generation] Trying ${candidateUrls.length} URL(s) for run=${runId}`);

        let lastError: any = null;
        for (const targetUrl of candidateUrls) {
            try {
                console.log(`[API /api/generation] Submitting: ${targetUrl}`);

                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(targetUrl, {
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
                    console.warn(`[API /api/generation] ${targetUrl} returned ${response.status}: ${errorBody}`);
                    lastError = { status: response.status, message: errorBody };
                    continue; // Try next URL
                }

                const data = await response.json();
                console.log(`[API /api/generation] ✅ Successfully reached ${targetUrl}`);
                console.log(`[API /api/generation] Response data snippet:`, JSON.stringify(data).substring(0, 200));
                
                return NextResponse.json(data, { status: 200 });

            } catch (fetchErr: any) {
                const reason = fetchErr.name === 'AbortError' ? 'Request timed out (15s)' : fetchErr.message || 'fetch failed';
                console.warn(`[API /api/generation] ${targetUrl} connection error: ${reason}`);
                lastError = { status: 503, message: reason };
                continue;
            }
        }

        console.error(`[API /api/generation] All endpoints failed to return payload. Last Error:`, lastError);
        return NextResponse.json(
            {
                error: "Backend returned 404 or unreachable",
                details: lastError?.message || "All endpoints exhausted/failed",
                attempted_urls: candidateUrls,
                last_status_code: lastError?.status
            },
            { status: lastError?.status || 503 }
        );

    } catch (err: any) {
        console.error("[API /api/generation GET] Fatal Error:", err.message);
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to fetch generation data" }, { status });
    }
}
