// app/api/tableau/projects/route.ts
// POST /api/tableau/projects
// Alias for /api/tableau/propagate-tableau-details
// ðŸš¨ MUST accept: email, tableau_server_url, tableau_site_name

import { NextRequest, NextResponse } from "next/server";
import { httpPost, errorResponse } from "@/lib/api/httpClient";

export const dynamic = 'force-dynamic';

export interface TableauProjectsRequest {
  email: string;
  tableau_server_url: string;
  tableau_site_name: string;
  tableau_token_name?: string;
}

export interface TableauProjectsResponse {
  projects: Array<{ id: string; name: string; description?: string }>;
}

export async function POST(req: NextRequest) {
  try {
    let body: TableauProjectsRequest;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        error: "Invalid or missing JSON body",
        code: "INVALID_BODY"
      }, { status: 400 });
    }

    // Validate required fields
    const missing: string[] = [];
    if (!body.email?.trim()) missing.push("email");
    if (!body.tableau_server_url?.trim()) missing.push("tableau_server_url");
    // tableau_site_name is optional now

    if (missing.length > 0) {
      console.error(`[API /api/tableau/projects] âŒ Missing fields: ${missing.join(", ")}`);
      return NextResponse.json(
        {
          error: `Missing required fields: ${missing.join(", ")}`,
          code: "VALIDATION_ERROR",
          missing
        },
        { status: 422 } // Unprocessable Entity
      );
    }

    // Extract Authorization header
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error("[API /api/tableau/projects] âŒ Missing Authorization header");
      return NextResponse.json(
        {
          error: "Unauthorized - Missing Authorization header",
          code: "MISSING_AUTH_HEADER"
        },
        { status: 401 }
      );
    }

    console.log(`[API /api/tableau/projects] âœ… Request for ${body.email}`);

    const forwardHeaders = {
      Authorization: authHeader,
    };

    // Call Tableau backend
    const result = await httpPost<TableauProjectsResponse>(
      "tableau",
      "/propagate-tableau-details",
      {
        email: body.email.trim(),
        TABLEAU_SERVER_URL: body.tableau_server_url.trim(),
        TABLEAU_SITE_NAME: body.tableau_site_name?.trim() || "", // SAFE: defaults to empty string
        TABLEAU_TOKEN_NAME: body.tableau_token_name?.trim() || "TableauToken",
      },
      {
        headers: {
          Authorization: authHeader,
        }
      }
    );

    console.log(`[API /api/tableau/projects] âœ… Received ${result.data.projects?.length || 0} projects`);

    return NextResponse.json(result.data, { status: 200 });

  } catch (err: unknown) {
    console.error("[API /api/tableau/projects] âŒ Error:", err);
    const { body: errBody, status } = errorResponse(err, "Failed to fetch Tableau projects");
    return NextResponse.json(errBody, { status });
  }
}
