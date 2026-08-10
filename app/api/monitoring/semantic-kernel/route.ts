import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email_id = searchParams.get("email_id");
        const page = searchParams.get("page") || "1";
        const page_size = searchParams.get("page_size") || "10";

        // ── Authorization ────────────────────────────────────────────────
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json(
                { error: "Unauthorized: Missing Authorization header" },
                { status: 401 }
            );
        }

        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            return NextResponse.json(
                { error: "Server configuration error: LOGS_API_BASE missing" },
                { status: 500 }
            );
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        // Fixed path: baseUrl already has /api/records
        const targetUrl = new URL(`${baseUrl}/semantic-kernel`);

        if (email_id) {
            targetUrl.searchParams.append("email_id", email_id);
        }
        targetUrl.searchParams.append("page", page);
        targetUrl.searchParams.append("page_size", page_size);
        targetUrl.searchParams.append("pageSize", page_size);

        console.log(`[API monitoring/semantic-kernel] Forwarding to: ${targetUrl.toString()}`);

        const response = await fetch(targetUrl.toString(), {
            method: "GET",
            headers: {
                Authorization: authHeader,
                Accept: "application/json",
            },
            cache: "no-store",
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return NextResponse.json(
                { error: `Backend returned ${response.status}`, details: errorBody },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        return NextResponse.json(
            { error: "Failed to fetch semantic kernel runs", details: getErrorMessage(err) },
            { status: 500 }
        );
    }
}
