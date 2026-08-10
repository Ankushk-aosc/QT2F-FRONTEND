
import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";
import { validateTokenAudience } from "@/lib/token-validation";

export const dynamic = 'force-dynamic';

// GET: fetch assessment data from logs backend
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

        console.log(`[API /api/assessment] Query: project=${projectId}, workbook=${workbookId}, run=${runId}`);

        // Construct URL using LOGS_API_BASE
        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            throw new Error("LOGS_API_BASE is not defined");
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/assessment?${query}`;

        console.log(`[API /api/assessment] Target URL: ${targetUrl}`);

        try {
            const data = await fetchWithAuth(targetUrl, authHeader);
            return NextResponse.json(data, { status: 200 });
        } catch (fetchErr: any) {
            // â˜… Network error â€” backend unreachable
            if (fetchErr.message?.includes('fetch failed') || fetchErr.message?.includes('ENOTFOUND') || fetchErr.message?.includes('ECONNREFUSED')) {
                console.warn(`[API /api/assessment GET] Backend unreachable: ${fetchErr.message}`);
                return NextResponse.json(
                    { error: "Backend unreachable", details: fetchErr.message },
                    { status: 503 }
                );
            }
            throw fetchErr; // re-throw non-network errors
        }
    } catch (err: any) {
        console.error("[API /api/assessment GET] Error:", err.message);
        return NextResponse.json(
            { error: "Failed to fetch assessment data", details: err.message },
            { status: 500 }
        );
    }
}

// POST: start batch assessment via semantic kernel
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Validate Token Audience
        const token = authHeader.replace("Bearer ", "");
        if (!validateTokenAudience(token)) {
            console.warn("[API /api/assessment] Invalid Token Audience");
        }

        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.user_email || !body.items?.length) {
            return NextResponse.json({ error: "user_email and items required" }, { status: 400 });
        }

        const data = await httpClient.post<{ run_id: string }>(
            "/batch-assessment",
            body,
            {
                apiType: "semantic",
                headers: { "Authorization": authHeader }
            }
        );

        return NextResponse.json(data, { status: 200 });
    } catch (err: any) {
        console.error("[API /api/assessment POST] Error:", err.message);
        return NextResponse.json(
            { error: "Failed to start assessment", details: err.message },
            { status: 500 }
        );
    }
}
