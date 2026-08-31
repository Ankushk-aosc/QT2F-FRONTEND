// app/api/tableau/workbooks/route.ts
// POST /api/tableau/workbooks â€” get workbooks for a project
// ðŸš¨ MUST accept: email, tableau_server_url, tableau_site_name, project_id

import { NextRequest, NextResponse } from "next/server";
import { httpPost, httpClient, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export interface TableauWorkbooksRequest {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  tableau_token_value?: string;
  project_id: string | string[];
  connection_id?: string;
}

export interface TableauWorkbooksResponse {
  workbooks: Array<{
    id: string;
    name: string;
    description?: string;
    project_id: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    // ðŸš¨ CRITICAL: Extract Authorization header
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error("[API /api/tableau/workbooks] âŒ Missing Authorization header");
      return NextResponse.json(
        {
          error: "Unauthorized - Missing Authorization header",
          code: "MISSING_AUTH_HEADER"
        },
        { status: 401 }
      );
    }

    console.log("[API /api/tableau/workbooks] âœ… Authorization header present");

    let body: TableauWorkbooksRequest;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        error: "Invalid or missing JSON body",
        code: "INVALID_BODY"
      }, { status: 400 });
    }

    // Validate required fields: project_id is mandatory, server URL & site name only if no connection_id
    const missing: string[] = [];
    if (!body.project_id) missing.push("project_id");
    if (!body.connection_id) {
      if (!body.tableau_server_url?.trim()) missing.push("tableau_server_url");
      if (!body.tableau_site_name?.trim()) missing.push("tableau_site_name");
    }

    if (missing.length > 0) {
      console.error(`[API /api/tableau/workbooks] ❌ Missing fields: ${missing.join(", ")}`);
      return NextResponse.json(
        {
          error: `Missing required fields: ${missing.join(", ")}`,
          code: "VALIDATION_ERROR",
          missing
        },
        { status: 422 }
      );
    }

    // Normalize project_id to array
    let projectIds: string[];
    if (typeof body.project_id === "string") {
      projectIds = [body.project_id];
    } else if (Array.isArray(body.project_id)) {
      projectIds = body.project_id;
    } else {
      return NextResponse.json(
        {
          error: "project_id must be a string or array of strings",
          code: "INVALID_PROJECT_ID"
        },
        { status: 422 }
      );
    }

    console.log(`[API /api/tableau/workbooks] Request for ${projectIds.length} project(s)`);

    // Forward Authorization header
    const forwardHeaders: Record<string, string> = {
      Authorization: authHeader,
    };

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
                console.log("[API /api/tableau/workbooks] Auto-resolved connection metadata from MongoDB connection_id:", { serverUrl, siteName, tokenName });
            }
        } catch (lookupErr: any) {
            console.warn("[API /api/tableau/workbooks] Could not resolve connection_id lookup:", lookupErr?.message);
        }
    }

    if (!tokenName) tokenName = "token";

    // Build backend request body forwarding all property alias variants
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
      PROJECT_ID: projectIds,
      project_id: projectIds,
      email: body.email || ""
    };

    if (body.connection_id) {
       requestBody.connection_id = body.connection_id;
    }

    if (body.tableau_token_value?.trim()) {
       requestBody.TABLEAU_TOKEN_VALUE = body.tableau_token_value.trim();
       requestBody.tableau_token_value = body.tableau_token_value.trim();
    }

    console.log("[API /api/tableau/workbooks] Forwarding to backend:", {
      ...requestBody,
      PROJECT_ID: `[${projectIds.length} project(s)]`
    });

    let allWorkbooks: any[] = [];
    let pageNumber = 1;
    let pageSize = 100;
    let hasMore = true;
    let previousTotal = 0;

    while (hasMore) {
        // Send pagination params in multiple formats to maximize compatibility with the python backend
        requestBody.PAGE_NUMBER = pageNumber;
        requestBody.PAGE_SIZE = pageSize;
        requestBody.pageNumber = pageNumber;
        requestBody.pageSize = pageSize;
        requestBody.page_number = pageNumber;
        requestBody.page_size = pageSize;
        
        console.log(`[API /api/tableau/workbooks] Fetching Workbook Page ${pageNumber}`);
        
        const result = await httpPost<any>(
          "tableau",
          "/get-workbooks",
          requestBody,
          forwardHeaders
        );

        const workbooks = result.data.workbooks || [];
        allWorkbooks = [...allWorkbooks, ...workbooks];

        // Deduplicate using Workbook ID to avoid infinite loops if backend ignores pagination
        const uniqueMap = new Map();
        allWorkbooks.forEach(wb => {
          if (wb && wb.id) uniqueMap.set(wb.id, wb);
        });
        allWorkbooks = Array.from(uniqueMap.values());

        if (allWorkbooks.length === previousTotal || workbooks.length === 0) {
             hasMore = false;
             break;
        }
        previousTotal = allWorkbooks.length;

        const totalAvailable = result.data.pagination?.totalAvailable || result.data.totalAvailable || result.data.total_available;
        
        if (totalAvailable !== undefined) {
             if (allWorkbooks.length >= totalAvailable) {
                 hasMore = false;
             } else {
                 pageNumber++;
             }
        } else {
             if (workbooks.length < pageSize) {
                 hasMore = false;
             } else {
                 pageNumber++;
             }
        }
    }

    // Sort workbooks alphabetically
    allWorkbooks.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    console.log(`[API /api/tableau/workbooks] ✅ Total Workbooks Retrieved: ${allWorkbooks.length}`);

    // Return successful response keeping original contract
    return NextResponse.json({ workbooks: allWorkbooks }, { status: 200 });

  } catch (err: unknown) {
    console.error("[API /api/tableau/workbooks] âŒ Error:", err);
    const { body: errBody, status } = errorResponse(err, "Failed to fetch workbooks");

    // âŒ NEVER return empty array â€” return structured error
    return NextResponse.json(errBody, { status });
  }
}
