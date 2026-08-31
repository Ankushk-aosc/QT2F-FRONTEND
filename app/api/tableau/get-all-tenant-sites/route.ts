
import { NextRequest, NextResponse } from "next/server";
import { httpPost, httpClient, errorResponse } from "@/lib/api/httpClient";

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
        const connectionId = body.connection_id || body.connectionId;

        let tcmBaseUrl = body.tcm_base_url || body.TCM_BASE_URL || body.tcmBaseUrl || "";
        const tcmTokenSecret = body.tcm_token_secret || body.TCM_TOKEN_SECRET || body.tcmTokenSecret || "";

        // Fallback: If connection_id is provided but tcm_base_url is missing, resolve connection from storage
        if (connectionId && !tcmBaseUrl) {
            try {
                const connRes = await httpClient.get<any>("/tableau/connections", {
                    apiType: "semantic",
                    headers: { Authorization: authHeader },
                });
                const connections = Array.isArray(connRes) ? connRes : (connRes?.connections || []);
                const match = connections.find((c: any) => (c.id === connectionId || c.connection_id === connectionId));
                if (match) {
                    tcmBaseUrl = match.tcm_base_url || match.TCM_BASE_URL || match.tcmBaseUrl || "";
                    console.log("[POST /api/tableau/get-all-tenant-sites] Auto-resolved TCM_BASE_URL from connection_id:", tcmBaseUrl);
                }
            } catch (lookupErr: any) {
                console.warn("[POST /api/tableau/get-all-tenant-sites] Could not resolve connection_id lookup:", lookupErr?.message);
            }
        }

        let requestBody: any = {
            tcm_base_url: tcmBaseUrl,
            TCM_BASE_URL: tcmBaseUrl,
            tcm_token_secret: tcmTokenSecret,
            TCM_TOKEN_SECRET: tcmTokenSecret,
        };

        if (connectionId) {
            requestBody.connection_id = connectionId;
        }

        const forwardHeaders: Record<string, string> = {
            "Authorization": authHeader
        };

        const result = await httpPost<any>(
            "tableau",
            "/get-all-tenant-sites",
            requestBody,
            { headers: forwardHeaders }
        );

        return NextResponse.json(result.data, { status: 200 });

    } catch (err: any) {
        const { body, status } = errorResponse(err, "Failed to get Tableau sites");
        return NextResponse.json(body, { status });
    }
}

