// app/api/datalayer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { serverFetchWithAuth as fetchWithAuth } from "@/lib/api/serverFetch";

export const dynamic = 'force-dynamic';

// GET: fetch data layer results from logs backend
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.toString();
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized: Missing Authorization header" }, { status: 401 });
        }

        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            throw new Error("LOGS_API_BASE is not defined");
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        const targetUrl = `${baseUrl}/records/data-layer?${query}`;

        console.log(`[API /api/datalayer GET] Target URL: ${targetUrl}`);

        try {
            const data = await fetchWithAuth(targetUrl, authHeader);
            return NextResponse.json(data, { status: 200 });
        } catch (fetchErr: any) {
            if (fetchErr.message?.includes('fetch failed') || fetchErr.message?.includes('ENOTFOUND') || fetchErr.message?.includes('ECONNREFUSED')) {
                return NextResponse.json(
                    { error: "Backend unreachable", details: fetchErr.message },
                    { status: 503 }
                );
            }
            throw fetchErr;
        }
    } catch (err: any) {
        console.error("[API /api/datalayer GET] Error:", err.message);
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to fetch data layer results" }, { status });
    }
}

// POST: trigger data layer agent via semantic kernel
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: any;
        try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

        if (!body.run_id || !body.items?.length) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // Semantic Kernel has no /data-layer endpoint. The data-layer agent runs
        // as a stage of /invoke-batch; its results are read back from
        // /api/records/data-layer.
        console.warn(
            `[API /api/datalayer POST] No /data-layer endpoint exists upstream (run ${body.run_id}) — returning 501.`
        );
        return NextResponse.json(
            {
                error: "Starting the data layer agent directly is not supported.",
                details:
                    "Semantic Kernel runs the data-layer agent as a stage of POST /api/migration/invoke-batch. " +
                    "Read its output from GET /api/records/data-layer.",
            },
            { status: 501 }
        );
    } catch (err: any) {
        console.error("[API /api/datalayer POST] Error:", err.message);
        const status = err.status || 500;
        return NextResponse.json({ error: err.message || "Failed to start data layer agent" }, { status });
    }
}
