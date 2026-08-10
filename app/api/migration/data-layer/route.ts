// app/api/migration/data-layer/route.ts
// GET /api/migration/data-layer?project_id=...&workbook_id=...&run_id=...
// POST /api/migration/data-layer — trigger data layer agent
// Rule 7: Frontend → /api/* → Backend

import { NextRequest, NextResponse } from "next/server";
import { httpGet, httpPost, errorResponse } from "@/lib/api/httpClient";

// GET: fetch data layer agent results from logs backend
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.toString();

        if (!query) {
            return NextResponse.json({ error: "Query parameters required" }, { status: 400 });
        }

        const result = await httpGet<unknown>("logs", `/data-layer?${query}`);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/migration/data-layer GET] Error:", err);
        const { body, status } = errorResponse(err, "Failed to fetch data layer results");
        return NextResponse.json(body, { status });
    }
}

// POST: trigger data layer agent via semantic kernel
export async function POST(req: NextRequest) {
    try {
        let body: { items: Array<{ project_id: string; workbook_id: string }>; run_id: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
        }

        if (!body.run_id || !body.items?.length) {
            return NextResponse.json(
                { error: "run_id and items are required" },
                { status: 400 }
            );
        }

        const result = await httpPost<{ status: string }>("semantic", "/data-layer", body);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/migration/data-layer POST] Error:", err);
        const { body, status } = errorResponse(err, "Failed to start data layer agent");
        return NextResponse.json(body, { status });
    }
}
