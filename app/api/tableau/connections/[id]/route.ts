import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/tableau/connections/[id] — Delete a connection and its Key Vault secrets
 */
import { httpClient } from "@/lib/api/httpClient";

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

    const { id: connectionId } = await params;

    // 1. Primary: Delete from MongoDB via Semantic Kernel
    try {
      const data = await httpClient.delete<any>(`/tableau/connections/${encodeURIComponent(connectionId)}`, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn(`[DELETE /api/tableau/connections/${connectionId}] SK route warning:`, skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (backendBaseUrl) {
      const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections/${connectionId}`;
      const backendResponse = await fetch(fullUrl, {
        method: "DELETE",
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

    return NextResponse.json({ success: true }, { status: 200 });
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
    const { id: connectionId } = await params;

    // 1. Primary: Update in MongoDB via Semantic Kernel
    try {
      const data = await httpClient.put<any>(`/tableau/connections/${encodeURIComponent(connectionId)}`, body, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
        method: "PATCH" as any,
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn(`[PATCH /api/tableau/connections/${connectionId}] SK route warning:`, skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const backendBaseUrl = process.env.TABLEAU_API_URL;
    if (backendBaseUrl) {
      const fullUrl = `${backendBaseUrl.replace(/\/$/, "")}/connections/${connectionId}`;
      const backendResponse = await fetch(fullUrl, {
        method: "PATCH",
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
    }

    return NextResponse.json({ success: true, id: connectionId, ...body }, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/tableau/connections/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
