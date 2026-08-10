import { NextRequest, NextResponse } from "next/server";
import { httpPost, errorResponse } from "@/lib/api/httpClient";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        if (!body.run_id || !body.email) {
            return NextResponse.json(
                { error: "run_id and email are required" },
                { status: 400 }
            );
        }

        // Same payload structure as /run-validation
        const payload = {
            run_id: Array.isArray(body.run_id) ? body.run_id : [body.run_id],
            email: body.email,
            ...(body.fabric_access_token ? { fabric_access_token: body.fabric_access_token } : {})
        };

        const result = await httpPost<{ status: string }>("semantic", "/revalidate", payload);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/revalidate POST] Error:", err);
        const { body, status } = errorResponse(err, "Failed to start revalidation");
        return NextResponse.json(body, { status });
    }
}
