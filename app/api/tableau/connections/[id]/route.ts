import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/tableau/connections/[id] — Delete a connection and its Key Vault secrets
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: connectionId } = await params;
    const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections/${connectionId}`;
    console.log("[DELETE /api/tableau/connections/[id]] Forwarding to:", fullUrl);

    const backendResponse = await fetch(fullUrl, {
      method: "DELETE",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!backendResponse.ok) {
      let errorText = "";
      try {
        const errorJson = await backendResponse.json();
        errorText = JSON.stringify(errorJson);
      } catch {
        errorText = await backendResponse.text();
      }
      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    console.error("[DELETE /api/tableau/connections/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tableau/connections/[id] - Update an existing connection
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: connectionId } = await params;
    const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections/${connectionId}`;
    console.log("[PATCH /api/tableau/connections/[id]] Forwarding to:", fullUrl);

    const backendResponse = await fetch(fullUrl, {
      method: "PATCH",
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
          // Keep raw text if it's not JSON
        }
      } catch (readError) {
        errorText = `Could not read error response: ${readError}`;
      }
      console.error(`[PATCH connections/[id]] Backend failed: ${backendResponse.status} - ${errorText}`);
      return NextResponse.json(
        { error: "Backend request failed", details: errorText },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    console.error("[PATCH /api/tableau/connections/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
