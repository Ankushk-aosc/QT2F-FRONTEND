// app/api/migration/process-site/route.ts
import { NextRequest, NextResponse } from "next/server";
import { RT_COOKIE } from "@/lib/auth/serverAuth";

export const dynamic = 'force-dynamic';

export interface ProcessSiteRequest {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
  project_id?: string | string[];   // single project ID or array of project IDs
  group_id?: string;
  workspace_id?: string;
  folder_name?: string;
  onelake_token?: string;
  fabric_access_token?: string;
  site_id?: string;
  source_type?: string;
  lakehouse_id?: string;
  connection_id?: string;
}

export interface ProcessSiteResponse {
  run_id?: string;
  runId?: string;
  message?: string;
  success?: boolean;
  data?: any;
  [key: string]: any;
}

export async function POST(req: NextRequest) {
  try {
    let body: ProcessSiteRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    const { email, tableau_server_url, tableau_site_name = "", project_id, group_id, folder_name } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!tableau_server_url?.trim()) {
      return NextResponse.json(
        { error: "tableau_server_url is required" },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized - Missing Authorization header", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    // Build clean forwarded payload — single project_id or none
    const forwardBody: Record<string, string> = {
      email: email.trim(),
      tableau_server_url: tableau_server_url.trim(),
      tableau_site_name: (tableau_site_name || "").trim(),
      tableau_token_name: body.tableau_token_name?.trim() || "TableauToken",
    };

    if (group_id && group_id.trim()) {
      forwardBody.group_id = group_id.trim();
      forwardBody.workspace_id = group_id.trim();
    }
    
    if (body.workspace_id && body.workspace_id.trim()) {
      forwardBody.workspace_id = body.workspace_id.trim();
    }

    if (folder_name && folder_name.trim()) {
      forwardBody.folder_name = folder_name.trim();
    }

    if (project_id) {
      // Forward as-is: backend accepts both string and array
      (forwardBody as any).project_id = Array.isArray(project_id)
        ? project_id.map((id: string) => id.trim())
        : [project_id.trim()];
    }

    if (body.onelake_token) {
      forwardBody.onelake_token = body.onelake_token;
    }

    if (body.fabric_access_token) {
      forwardBody.fabric_access_token = body.fabric_access_token;
    }

    if (body.site_id !== undefined) {
      forwardBody.site_id = body.site_id.trim();
    } else {
      forwardBody.site_id = "";
    }

    if (body.source_type !== undefined) {
      forwardBody.source_type = body.source_type.trim();
    } else {
      forwardBody.source_type = "cloud";
    }

    if (body.lakehouse_id !== undefined) {
      forwardBody.lakehouse_id = body.lakehouse_id.trim();
    }

    if (body.connection_id && body.connection_id.trim()) {
      forwardBody.connection_id = body.connection_id.trim();
    }

    // Seed the server-held refresh_token (if present) so SK Strategy 0 can renew
    // Fabric/OneLake tokens during long runs without OBO. Never trust a client-sent RT.
    const seededRt = req.cookies.get(RT_COOKIE)?.value;
    if (seededRt) {
      forwardBody.refresh_token = seededRt;
    }

    console.log("[API /api/migration/process-site] Forwarding (rt seeded:", Boolean(seededRt), ")");

    // Semantic Kernel exposes /qlik/process-space but has no Tableau
    // counterpart — /tableau/process-site does not exist. Whole-site Tableau
    // migration goes through /invoke-batch with the site's workbooks as items.
    console.warn(
      "[API /api/migration/process-site] No /tableau/process-site endpoint exists upstream — returning 501."
    );
    return NextResponse.json(
      {
        error: "Whole-site Tableau migration is not available as a single call.",
        details:
          "Semantic Kernel has no /tableau/process-site endpoint. Use POST /api/migration/invoke-batch " +
          "with the site's workbooks as items.",
      },
      { status: 501 }
    );
  } catch (err: any) {
    console.error("[API /api/migration/process-site] Error:", err);
    const status = err?.status || 500;
    const message = err?.message || "Failed to process site migration";

    return NextResponse.json(
      { error: message, details: err?.stack || String(err) },
      { status }
    );
  }
}
