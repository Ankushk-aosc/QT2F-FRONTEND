import { NextRequest, NextResponse } from "next/server";
import { getQlikApiBaseUrl } from "@/lib/qlikApiBaseUrl";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate request body
    if (!body.appId || !body.appName) {
      return NextResponse.json(
        { error: "Missing appId or appName in request body" },
        { status: 400 }
      );
    }

    const baseUrl = getQlikApiBaseUrl();
    if (!baseUrl) {
      return NextResponse.json(
        { error: "Qlik API URL is not configured. Please set NEXT_PUBLIC_QLIK_API_BASE_URL." },
        { status: 500 }
      );
    }

    console.log("Unbuilding Qlik app with ID:", body.appId, "and Name:", body.appName);
    const UNBUILD_API = `${baseUrl}/unbuildApp`;
    const response = await fetch(
      UNBUILD_API,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ appId: body.appId, appName: body.appName }),
      }
    );

    const responseBody = await response.text();
    if (!response.ok) {
      console.error("External API error:", {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      });
      return NextResponse.json(
        {
          error: "Failed to unbuild Qlik app",
          details: responseBody || response.statusText,
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseBody);
    console.log("Unbuild successful:", data);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Proxy error:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "Failed to unbuild Qlik app",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}