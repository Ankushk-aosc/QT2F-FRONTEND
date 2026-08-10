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
  items: Array<{ project_id: string; workbook_id: string; workbook_name?: string }>;
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

    if (!email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    if (!tableau_server_url?.trim()) {
      return NextResponse.json({ error: "tableau_server_url is required" }, { status: 400 });
    }

    if (!items?.length) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.project_id?.trim() || !item.workbook_id?.trim()) {
        return NextResponse.json(
          { error: `Item ${i + 1} missing project_id or workbook_id` },
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
      { apiType: "semantic" }
    );

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/migration/invoke-batch] Error:", err);
    return NextResponse.json(
      { error: "Failed to invoke batch migration", details: err.message },
      { status: 500 }
    );
  }
}
