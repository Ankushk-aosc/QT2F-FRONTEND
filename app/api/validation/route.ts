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
        const validationBase = process.env.VALIDATION_API_URL;

        const candidateUrls: string[] = [];

        if (logsBase) {
            const base = logsBase.replace(/\/$/, "");
            // LOGS_API_BASE is ".../api", not ".../api/records" — the records
            // segment has to be spelled out to reach /api/records/validation.
            candidateUrls.push(`${base}/records/validation?${query}`);
        }

        if (validationBase) {
            const base = validationBase.replace(/\/$/, "");
            candidateUrls.push(`${base}/validation?${query}`);
            candidateUrls.push(`${base}/api/records/validation?${query}`);
        }

        if (candidateUrls.length === 0) {
            throw new Error("Neither LOGS_API_BASE nor VALIDATION_API_URL is defined");
        }

        console.log(`[API /api/validation] Trying ${candidateUrls.length} URL(s) for run=${runId}`);

        let lastError: any = null;
        for (const targetUrl of candidateUrls) {
            try {
                console.log(`[API /api/validation] Submitting: ${targetUrl}`);

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
                    console.warn(`[API /api/validation] ${targetUrl} returned ${response.status}: ${errorBody}`);
                    lastError = { status: response.status, message: errorBody };
                    continue; // Try next URL
                }

                const data = await response.json();
                console.log(`[API /api/validation] ✅ Successfully reached ${targetUrl}`);
                console.log(`[API /api/validation] Response data snippet:`, JSON.stringify(data).substring(0, 200));
                return NextResponse.json(data, { status: 200 });

            } catch (fetchErr: any) {
                const reason = fetchErr.name === 'AbortError' ? 'Request timed out (15s)' : fetchErr.message || 'fetch failed';
                console.warn(`[API /api/validation] ${targetUrl} connection error: ${reason}`);
                lastError = { status: 503, message: reason };
                continue;
            }
        }

        console.error(`[API /api/validation] All endpoints failed to return payload. Last Error:`, lastError);
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
        console.error("[API /api/validation GET] Fatal Error:", err.message);
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to fetch validation data" }, { status });
    }
}
