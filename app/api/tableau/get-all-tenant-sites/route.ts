
import { NextRequest, NextResponse } from "next/server";
import { httpPost, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return NextResponse.json(
                { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
                { status: 401 }
            );
        }

        const body = await req.json();

        const forwardHeaders: Record<string, string> = {
            "Authorization": authHeader
        };

        // Forward full body so backend can use tcm_token_secret as fallback
        const result = await httpPost<any>(
            "tableau",
            "/get-all-tenant-sites",
            { 
                TCM_BASE_URL: body.tcm_base_url || body.TCM_BASE_URL,
                tcm_token_secret: body.tcm_token_secret || "",
                connection_id: body.connection_id,
            },
            { headers: forwardHeaders }
        );

        return NextResponse.json(result.data, { status: 200 });

    } catch (err: any) {
        const { body, status } = errorResponse(err, "Failed to get Tableau sites");
        return NextResponse.json(body, { status });
    }
}
