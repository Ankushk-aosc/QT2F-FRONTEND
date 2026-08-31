import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/tableau/connections — Create or update a connection
 * GET  /api/tableau/connections — List all connections (no secrets)
 */

import { httpClient } from "@/lib/api/httpClient";

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

    // 1. Primary: Save directly in MongoDB via Semantic Kernel
    try {
      const data = await httpClient.post<any>("/tableau/connections", body, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn("[POST /api/tableau/connections] SK route warning, trying microservice fallback:", skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (backendBaseUrl) {
      const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections`;
      const backendResponse = await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (backendResponse.ok) {
        const result = await backendResponse.json();
        return NextResponse.json(result, { status: 200 });
      }
      let errorText = "";
      try {
        const textData = await backendResponse.text();
        errorText = textData;
      } catch (readError) {
        errorText = `Could not read error response: ${readError}`;
      }
      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json({ error: "No backend available" }, { status: 500 });
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

    const envType = req.nextUrl.searchParams.get("env_type") || "";
    const queryString = envType ? `?env_type=${encodeURIComponent(envType)}` : "";

    // 1. Primary: Use Semantic Kernel with direct MongoDB Atlas persistence
    try {
      const data = await httpClient.get<any>(`/tableau/connections${queryString}`, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (Array.isArray(data)) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn("[GET /api/tableau/connections] SK route warning, trying microservice fallback:", skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (backendBaseUrl) {
      const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections${queryString}`;
      const backendResponse = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      });

      if (backendResponse.ok) {
        const result = await backendResponse.json();
        return NextResponse.json(result, { status: 200 });
      }
    }

    return NextResponse.json([], { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/tableau/connections] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
