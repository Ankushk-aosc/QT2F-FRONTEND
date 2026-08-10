
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
        
        // Forward the incoming Azure AD token unchanged so the backend can validate it
        const forwardHeaders: Record<string, string> = {
            "Authorization": authHeader
        };

        const result = await httpPost<any>(
            "tableau",
            "/server/sites",
            body,
            { headers: forwardHeaders }
        );

        return NextResponse.json(result.data, { status: 200 });

    } catch (err: any) {
        const { body, status } = errorResponse(err, "Failed to fetch server sites info");
        return NextResponse.json(body, { status });
    }
}
