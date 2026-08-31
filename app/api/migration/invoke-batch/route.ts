// app/api/migration/invoke-batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { RT_COOKIE } from "@/lib/auth/serverAuth";

export const dynamic = 'force-dynamic';

export interface InvokeBatchRequest {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  site_id?: string;
  source_type?: string;
  connection_id?: string;
  /**
   * Source-specific. Tableau items carry `project_id`/`workbook_id`; Qlik items
   * carry `workspace_id`/`app_id`. They are not mixed in one request.
   */
  items: Array<{
    project_id?: string;
    workbook_id?: string;
    workbook_name?: string;
    workspace_id?: string;
    workspace_name?: string;
    app_id?: string;
    app_name?: string;
  }>;
  model?: string;
  deployment_type?: string;
  department_repo?: string;
  fabric_group_id?: string;
  group_id?: string;
  workspace_id?: string;
  folder_name?: string;
  onelake_token?: string;
  fabric_access_token?: string;
  lakehouse_id?: string;
  refresh_token?: string;
}

export interface InvokeBatchResponse {
  run_id?: string;
  runId?: string;
  message?: string;
  assessment_summary?: string;
}

export async function POST(req: NextRequest) {
  try {
    let body: InvokeBatchRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
    }

    const { email, tableau_server_url, items } = body;
    // The orchestrator takes both sources on this endpoint. Qlik items are
    // keyed by workspace/app, Tableau items by project/workbook, so validation
    // has to follow the declared source rather than assuming Tableau — which
    // previously rejected every Qlik item with "missing project_id".
    const isQlik = body.source_type?.trim().toLowerCase() === "qlik";
    
    if (!isQlik) {
      body.source_type = "tableau";
      body.department_repo = "Tableau_Migrated";
      body.deployment_type = body.deployment_type || "DIRECT_FABRIC";
    }

    if (!body.fabric_group_id && body.group_id) {
      body.fabric_group_id = body.group_id;
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!isQlik && !tableau_server_url?.trim()) {
      return NextResponse.json({ error: "tableau_server_url is required" }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, string | undefined>;
      const missing = isQlik
        ? !item.workspace_id?.trim() || !item.app_id?.trim()
        : !item.project_id?.trim() || !item.workbook_id?.trim();

      if (missing) {
        return NextResponse.json(
          {
            error: isQlik
              ? `Item ${i + 1} missing workspace_id or app_id`
              : `Item ${i + 1} missing project_id or workbook_id`,
          },
          { status: 400 }
        );
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized - Missing Authorization header", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    // Seed the server-held refresh_token (if present) so SK Strategy 0 can renew
    // Fabric/OneLake tokens during long runs without OBO. Never trust a client-sent RT.
    const seededRt = req.cookies.get(RT_COOKIE)?.value;
    if (seededRt) {
      body.refresh_token = seededRt;
    }
    console.log(
      `[API /api/migration/invoke-batch] rt seeded: ${Boolean(seededRt)}${seededRt ? ` (len=${seededRt.length})` : ""}`
    );

    const data = await httpClient.post<InvokeBatchResponse>(
      "/invoke-batch",
      body,
      { 
         apiType: "semantic",
         headers: { Authorization: authHeader }
      }
    );

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/migration/invoke-batch] Error:", err);
    let details = err.message;
    if (details === "fetch failed") {
       details = "Failed to reach the Semantic Kernel backend. Ensure the server is running and accessible at the configured URL.";
    }
    return NextResponse.json(
      { error: "Failed to invoke batch migration", details: details, status: err.status || 502 },
      { status: err.status || 502 }
    );
  }
}
