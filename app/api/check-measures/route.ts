
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Parse JSON body
    const body = await request.json();

    // Validate body
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        {
          error:
            "Invalid request body. Expected an object with table names as keys and arrays of measures as values.",
        },
        { status: 400 }
      );
    }

    // 🔥 Extract Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    // Validate env variable
    const baseUrl = process.env.NEXT_PUBLIC_CONVERSION_URL;

    if (!baseUrl) {
      console.error(
        "Environment variable NEXT_PUBLIC_CONVERSION_URL is not defined."
      );
      return NextResponse.json(
        { error: "Server configuration error: missing NEXT_PUBLIC_CONVERSION_URL." },
        { status: 500 }
      );
    }

    const externalApiUrl = `${baseUrl}/verify/validate-dax-measures`;

    // 🔥 Forward request to external API always including token
    const externalResponse = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader, // IMPORTANT
      },
      body: JSON.stringify(body),
    });

    // If external API fails
    if (!externalResponse.ok) {
      const errorText = await externalResponse.text();
      console.error("External API error:", {
        status: externalResponse.status,
        statusText: externalResponse.statusText,
        body: errorText,
      });

      return NextResponse.json(
        { error: `External API validation failed: ${errorText}` },
        { status: externalResponse.status }
      );
    }

    // Parse successful response
    const externalData = await externalResponse.json();

    return NextResponse.json(externalData);

  } catch (error) {
    console.error("Internal error in /api/check-measures:", error);
    return NextResponse.json(
      { error: "Internal server error during measure validation." },
      { status: 500 }
    );
  }
}
