
import { NextRequest, NextResponse } from "next/server";
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
        const targetUrl = `${baseUrl}/records/assessment?${query}`;

        console.log(`[API /api/assessment] Target URL: ${targetUrl}`);

        try {
            const data = await fetchWithAuth(targetUrl, authHeader);
            if (data && (!Array.isArray(data) || data.length > 0)) {
                return NextResponse.json(data, { status: 200 });
            }
        } catch (fetchErr: any) {
            console.warn(`[API /api/assessment GET] Primary logsBase failed, attempting Qlik Mongo DB fallback: ${fetchErr.message}`);
        }

        // Fallback to Qlik Mongo DB
        const qlikMongoBase = process.env.QLIK_MONGO_DB_URL;
        if (qlikMongoBase) {
            const qlikUrl = `${qlikMongoBase.replace(/\/$/, "")}/assessment?${query}`;
            try {
                const qlikData = await fetchWithAuth(qlikUrl, authHeader);
                if (qlikData) {
                    return NextResponse.json(qlikData, { status: 200 });
                }
            } catch (qlikErr: any) {
                console.warn(`[API /api/assessment GET] Qlik Mongo DB query warning: ${qlikErr.message}`);
            }
        }

        return NextResponse.json({ error: "Assessment record not found", results: [] }, { status: 404 });
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

        // Semantic Kernel has no /batch-assessment. Assessment is not separately
        // orchestrated: it runs as a stage of /invoke-batch, or per-app through
        // the Assessment API at /api/qlik/assessment.
        console.warn(
            `[API /api/assessment POST] No /batch-assessment endpoint exists upstream (${body.items.length} item(s)) — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Batch assessment is not available as a standalone operation.",
                details:
                    "Semantic Kernel runs assessment as a stage of POST /api/migration/invoke-batch. " +
                    "For a single app, use POST /api/qlik/assessment.",
            },
            { status: 501 }
        );
    } catch (err: any) {
        console.error("[API /api/assessment POST] Error:", err.message);
        return NextResponse.json(
            { error: "Failed to start assessment", details: err.message },
            { status: 500 }
        );
    }
}
