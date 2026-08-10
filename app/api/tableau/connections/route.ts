import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tableau/connections — Create or update a connection
 * GET  /api/tableau/connections — List all connections (no secrets)
 */

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

    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (!backendBaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error: TABLEAU_API_URL missing" },
        { status: 500 }
      );
    }

    const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections`;
    console.log("[POST /api/tableau/connections] Forwarding to:", fullUrl);

    const backendResponse = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      let errorText = "";
      try {
        const textData = await backendResponse.text();
        errorText = textData;
        try {
          const errorJson = JSON.parse(textData);
          errorText = JSON.stringify(errorJson);
        } catch {
          // Keep raw text if it's not JSON (like 504 Gateway Timeout HTML)
        }
      } catch (readError) {
        errorText = `Could not read error response: ${readError}`;
      }
      console.error(`[POST connections] Backend failed: ${backendResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    console.error("[POST /api/tableau/connections] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}


export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized", code: "MISSING_AUTH_HEADER" },
        { status: 401 }
      );
    }

    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (!backendBaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error: TABLEAU_API_URL missing" },
        { status: 500 }
      );
    }

    // Forward query params (e.g., ?env_type=cloud)
    const envType = req.nextUrl.searchParams.get("env_type") || "";
    const queryString = envType ? `?env_type=${envType}` : "";
    const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections${queryString}`;

    const backendResponse = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!backendResponse.ok) {
      let errorText = "";
      try {
        const textData = await backendResponse.text();
        errorText = textData;
        try {
          const errorJson = JSON.parse(textData);
          errorText = JSON.stringify(errorJson);
        } catch {
          // Keep raw text if it's not JSON
        }
      } catch (readError) {
        errorText = `Could not read error response: ${readError}`;
      }
      console.error(`[GET /api/tableau/connections] Backend failed: ${backendResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    console.error("[GET /api/tableau/connections] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
