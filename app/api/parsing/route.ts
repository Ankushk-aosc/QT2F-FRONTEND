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
        const targetUrl = `${baseUrl}/records/parsing?${query}`;

        console.log(`[API /api/parsing] Target URL: ${targetUrl}`);

        try {
            const data = await fetchWithAuth(targetUrl, authHeader);
            if (data && (!Array.isArray(data) || data.length > 0)) {
                return NextResponse.json(data, { status: 200 });
            }
        } catch (fetchErr: any) {
            console.warn(`[API /api/parsing GET] Primary logsBase failed, attempting Qlik Mongo DB fallback: ${fetchErr.message}`);
        }

        // Fallback to Qlik Mongo DB
        const qlikMongoBase = process.env.QLIK_MONGO_DB_URL;
        if (qlikMongoBase) {
            const qlikUrl = `${qlikMongoBase.replace(/\/$/, "")}/parsing?${query}`;
            try {
                const qlikData = await fetchWithAuth(qlikUrl, authHeader);
                if (qlikData) {
                    return NextResponse.json(qlikData, { status: 200 });
                }
            } catch (qlikErr: any) {
                console.warn(`[API /api/parsing GET] Qlik Mongo DB query warning: ${qlikErr.message}`);
            }
        }

        return NextResponse.json({ error: "Parsing record not found" }, { status: 404 });
    } catch (err: any) {
        console.error("[API /api/parsing GET] Error:", err.message);
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

        if (!body) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const authHeader = req.headers.get("Authorization");

        const data = await httpClient.post<{ run_id: string }>(
            "/parse",
            body,
            {
                apiType: "qlik-parsing",
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
