import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";

export const dynamic = 'force-dynamic';

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

        console.log(`[API /api/parsing] Query: project=${projectId}, workbook=${workbookId}, run=${runId}`);
        console.log(`[API /api/parsing] Auth Header Present: true`);

        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            throw new Error("LOGS_API_BASE is not defined");
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/parsing?${query}`;

        console.log(`[API /api/parsing] Target URL: ${targetUrl}`);

        try {
            const data = await fetchWithAuth(targetUrl, authHeader);
            return NextResponse.json(data, { status: 200 });
        } catch (fetchErr: any) {
            // â˜… Network error â€” backend unreachable
            if (fetchErr.message?.includes('fetch failed') || fetchErr.message?.includes('ENOTFOUND') || fetchErr.message?.includes('ECONNREFUSED')) {
                console.warn(`[API /api/parsing GET] Backend unreachable: ${fetchErr.message}`);
                return NextResponse.json(
                    { error: "Backend unreachable", details: fetchErr.message },
                    { status: 503 }
                );
            }
            throw fetchErr; // re-throw non-network errors
        }
    } catch (err: any) {
        console.error("[API /api/parsing GET] Error:", err.message);
        // â˜… Preserve the original HTTP status from the backend (e.g. 404)
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to fetch parsing data" }, { status });
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

        const data = await httpClient.post<{ run_id: string }>(
            "/parse",
            body,
            {
                apiType: "semantic",
                headers: { "Authorization": authHeader! }
            }
        );
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("[API /api/parsing POST] Error:", err.message);
        // â˜… Preserve the original HTTP status from the backend (e.g. 404)
        const status = err.status || 500;
        return NextResponse.json({ error: err.message }, { status });
    }
}
