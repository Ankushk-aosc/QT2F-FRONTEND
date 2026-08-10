

// Updated file: api/get-tableau-url/route.ts
// Changes: Updated type to TableauCredentialsResponse[] (assuming backend returns list).

import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export interface TableauCredentialsResponse {
    TABLEAU_SERVER_URL: string;
    TABLEAU_SITE_NAME: string;
    TABLEAU_TOKEN_NAME: string;
    TABLEAU_TOKEN_VALUE?: string;
    TCM_BASE_URL?: string;
    TCM_TOKEN_SECRET?: string;
    PROJECT_ID?: string;
}

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            console.warn("[API /api/tableau/get-tableau-url] ❌ Missing Authorization header");
            return NextResponse.json(
                { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
                { status: 401 }
            );
        }

        const forwardHeaders: Record<string, string> = {
            "Authorization": authHeader
        };

        const envHeader = req.headers.get("x-tableau-environment");
        const endpoint = envHeader === "server" ? "/get-server-url" : "/get-cloud-url";

        const result = await httpGet<TableauCredentialsResponse[]>(
            "tableau",
            endpoint,
            { headers: forwardHeaders }
        );

        return NextResponse.json(result.data, { status: 200 });

    } catch (err: any) {
        console.error("[API /api/tableau/get-tableau-url] Error:", err.message);

        if (err.status === 401) {
            return NextResponse.json(
                { error: "Unauthorized - Backend session invalid", code: "BACKEND_UNAUTHORIZED" },
                { status: 401 }
            );
        }

        const { body, status } = errorResponse(err, "Failed to get Tableau URL");
        return NextResponse.json(body, { status });
    }
}