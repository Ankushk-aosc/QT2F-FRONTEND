// app/api/migration/generation/route.ts
// GET /api/migration/generation?project_id=...&workbook_id=...&run_id=...
// POST /api/migration/generation — trigger generation agent
// Rule 7: Frontend → /api/* → Backend

import { NextRequest, NextResponse } from "next/server";
import { httpGet, httpPost, errorResponse } from "@/lib/api/httpClient";

// GET: fetch generation agent results from logs backend
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.toString();

        if (!query) {
            return NextResponse.json({ error: "Query parameters required" }, { status: 400 });
        }

        const result = await httpGet<unknown>("logs", `/generation?${query}`);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/migration/generation GET] Error:", err);
        const { body, status } = errorResponse(err, "Failed to fetch generation results");
        return NextResponse.json(body, { status });
    }
}

// POST: trigger generation agent via semantic kernel
export async function POST(req: NextRequest) {
    try {
        let body: { 
            items: Array<{ project_id: string; workbook_id: string }>; 
            run_id: string;
            folder_name?: string;
            group_id?: string;
        };
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

        // Pass folder_name and group_id if provided
        const payload = {
            run_id: body.run_id,
            items: body.items,
            folder_name: body.folder_name,
            group_id: body.group_id
        };

        const result = await httpPost<{ status: string }>("semantic", "/generation", payload);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/migration/generation POST] Error:", err);
        const { body, status } = errorResponse(err, "Failed to start generation agent");
        return NextResponse.json(body, { status });
    }
}
