// app/api/tableau/propagate-tableau-details/route.ts
// POST /api/tableau/propagate-tableau-details
// Also available as: POST /api/tableau/projects
// Rule 6 MANDATORY contract:
//   Body MUST include: { email, tableau_server_url, tableau_site_name }
//   If ANY field is missing â†’ reject 400.

import { NextRequest, NextResponse } from "next/server";
import { httpPost, httpClient, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export interface PropagateTableauDetailsRequest {
    email?: string;
    tableau_server_url?: string;
    tableau_site_name?: string;
    tableau_token_name?: string;
    tableau_token_value?: string;
    site_id?: string;
    source_type?: string;
    project_id?: string;
    folder_name?: string;
    group_id?: string;
    connection_id?: string;
}

export interface PropagateTableauDetailsResponse {
    projects: Array<{ id: string; name: string; description?: string }>;
}

export async function POST(req: NextRequest) {
    try {
        let body: PropagateTableauDetailsRequest;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
        }

        // Extract and forward the Authorization header
        const authHeader = req.headers.get("Authorization");
        const forwardHeaders: Record<string, string> = {};
        if (authHeader) {
            forwardHeaders["Authorization"] = authHeader;
        }

        let serverUrl = body.tableau_server_url?.trim() || "";
        let siteName = body.tableau_site_name?.trim() || "";
        let tokenName = body.tableau_token_name?.trim() || "";

        // Fallback: If connection_id is passed, auto-resolve connection metadata from MongoDB
        if (body.connection_id && (!serverUrl || !siteName || !tokenName)) {
            try {
                const connRes = await httpClient.get<any>("/tableau/connections", {
                    apiType: "semantic",
                    headers: authHeader ? { Authorization: authHeader } : undefined,
                });
                const connections = Array.isArray(connRes) ? connRes : (connRes?.connections || []);
                const match = connections.find((c: any) => (c.id === body.connection_id || c.connection_id === body.connection_id));
                if (match) {
                    serverUrl = serverUrl || match.tableau_server_url || match.TABLEAU_SERVER_URL || "";
                    siteName = siteName || match.tableau_site_name || match.TABLEAU_SITE_NAME || "";
                    tokenName = tokenName || match.tableau_token_name || match.TABLEAU_TOKEN_NAME || "token";
                    console.log("[API propagate-tableau-details] Auto-resolved connection metadata from MongoDB connection_id:", { serverUrl, siteName, tokenName });
                }
            } catch (lookupErr: any) {
                console.warn("[API propagate-tableau-details] Could not resolve connection_id lookup:", lookupErr?.message);
            }
        }

        if (!tokenName) tokenName = "token";

        // Build backend request body with all property alias variants
        const requestBody: any = {
            tableau_server_url: serverUrl,
            tableau_site_name: siteName,
            tableau_token_name: tokenName,
            server_url: serverUrl,
            site_name: siteName,
            token_name: tokenName,
            TABLEAU_SERVER_URL: serverUrl,
            TABLEAU_SITE_NAME: siteName,
            TABLEAU_TOKEN_NAME: tokenName,
            email: body.email || ""
        };

        if (body.connection_id) {
            requestBody.connection_id = body.connection_id;
        }

        if (body.tableau_token_value?.trim()) {
            requestBody.TABLEAU_TOKEN_VALUE = body.tableau_token_value.trim();
            requestBody.tableau_token_value = body.tableau_token_value.trim();
        }

        if (body.site_id) requestBody.site_id = body.site_id;
        if (body.source_type) requestBody.source_type = body.source_type;
        if (body.project_id) requestBody.project_id = body.project_id;
        if (body.folder_name) requestBody.folder_name = body.folder_name;
        if (body.group_id) requestBody.group_id = body.group_id;

        console.log("[API propagate-tableau-details] Proxying to Tableau backend");

        // Proxy to Tableau backend with auth forwarded
        const result = await httpPost<PropagateTableauDetailsResponse>(
            "tableau",
            "/propagate-tableau-details",
            requestBody,
            { headers: forwardHeaders }
        );

        console.log(`[API propagate-tableau-details] âœ… Received ${result.data.projects?.length || 0} projects`);

        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        console.error("[API /api/tableau/propagate-tableau-details] Error:", err);
        const { body: errBody, status } = errorResponse(err, "Failed to propagate Tableau details");
        return NextResponse.json(errBody, { status });
    }
}
