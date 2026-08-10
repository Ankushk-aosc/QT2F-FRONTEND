import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tableau/post-tableau-url
 * 
 * Legacy endpoint — now forwards to the new /connections endpoint on the backend.
 * Kept for backward compatibility with any callers that still use this path.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.warn("[POST /api/tableau/post-tableau-url] Missing Authorization header");
      return NextResponse.json(
        { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    const body = await req.json();

    if (!body.TABLEAU_SERVER_URL) {
      return NextResponse.json(
        { error: "TABLEAU_SERVER_URL is required" },
        { status: 400 }
      );
    }

    const backendBaseUrl = process.env.TABLEAU_API_URL;

    if (!backendBaseUrl) {
      console.error("[POST /api/tableau/post-tableau-url] TABLEAU_API_URL is not set in .env");
      return NextResponse.json(
        { error: "Server configuration error: TABLEAU_API_URL missing" },
        { status: 500 }
      );
    }

    // Map legacy payload format to new connections format
    const isCloudURL = body.TABLEAU_SERVER_URL?.includes("online.tableau.com") || body.TABLEAU_SERVER_URL?.includes("tableau.com");
    const envType = (body.TCM_BASE_URL || isCloudURL) ? "cloud" : "server";

    const payload = {
      env_type: envType,
      tableau_server_url: body.TABLEAU_SERVER_URL,
      tableau_token_name: body.TABLEAU_TOKEN_NAME || "TableauToken",
      tableau_token_value: body.TABLEAU_TOKEN_VALUE || "",
      tcm_base_url: body.TCM_BASE_URL || "",
      tcm_token_secret: body.TCM_TOKEN_SECRET || "",
      server_token_secret: body.TABLEAU_SERVER_TOKEN_SECRET || "",
    };

    // Forward to the new connections endpoint
    const fullBackendUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections`;

    console.log("[POST /api/tableau/post-tableau-url] Forwarding to connections:", fullBackendUrl);

    const forwardHeaders: Record<string, string> = {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    };

    const backendResponse = await fetch(fullBackendUrl, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(payload),
    });

    if (!backendResponse.ok) {
      let errorText = "";
      try {
        const errorJson = await backendResponse.json();
        errorText = JSON.stringify(errorJson);
      } catch {
        errorText = await backendResponse.text() || "No response body";
      }

      console.error(
        `[POST] Backend failed: ${backendResponse.status} - ${errorText}`
      );

      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    console.error("[POST /api/tableau/post-tableau-url] Internal crash:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
