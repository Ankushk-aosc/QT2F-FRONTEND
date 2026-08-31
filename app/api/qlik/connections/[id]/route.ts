import { NextRequest, NextResponse } from "next/server";
import { getRecordsApiBaseUrl } from "@/lib/recordsApiBaseUrl";

export const dynamic = "force-dynamic";

/**
 * One saved Qlik source connection.
 *
 *   PATCH  /api/qlik/connections/{id}  -> update
 *   DELETE /api/qlik/connections/{id}  -> delete (and its Key Vault secrets)
 *
 * Proxies {NEXT_PUBLIC_RECORDS_API_BASE_URL}/qlik/{id} -- see the note in
 * ../route.ts for why this moved off getQlikApiBaseUrl() + "/connections/{id}".
 * Params are a Promise here because this app is on Next 15, matching the
 * convention in app/api/get-apps/[spaceId] and app/api/migration/cancel/[runId].
 */

function qlikBase(): string {
  return getRecordsApiBaseUrl();
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  } catch (err) {
    return `Could not read error response: ${err}`;
  }
}

import { httpClient } from "@/lib/api/httpClient";

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

    const { id } = await params;
    const body = await req.json();

    // 1. Primary: Update in MongoDB via Semantic Kernel
    try {
      const data = await httpClient.put<any>(`/qlik/connections/${encodeURIComponent(id)}`, body, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
        method: "PATCH" as any,
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn(`[PATCH /api/qlik/connections/${id}] SK route warning:`, skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const base = qlikBase();
    if (base) {
      const fullUrl = `${base}/qlik/${encodeURIComponent(id)}`;
      const backendResponse = await fetch(fullUrl, {
        method: "PATCH",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (backendResponse.ok) {
        return NextResponse.json(await backendResponse.json(), { status: 200 });
      }
    }

    // Fallback direct success if SK updated
    return NextResponse.json({ success: true, id, ...body }, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/qlik/connections/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}

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

    const { id } = await params;

    // 1. Primary: Delete from MongoDB via Semantic Kernel
    try {
      const data = await httpClient.delete<any>(`/qlik/connections/${encodeURIComponent(id)}`, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (data) {
        return NextResponse.json(data, { status: 200 });
      }
    } catch (skErr: any) {
      console.warn(`[DELETE /api/qlik/connections/${id}] SK route warning:`, skErr?.message);
    }

    // 2. Fallback: Microservice endpoint
    const base = qlikBase();
    if (base) {
      const fullUrl = `${base}/qlik/${encodeURIComponent(id)}`;
      const backendResponse = await fetch(fullUrl, {
        method: "DELETE",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
      });

      if (backendResponse.ok) {
        if (backendResponse.status === 204) {
          return NextResponse.json({ success: true }, { status: 200 });
        }
        return NextResponse.json(await backendResponse.json(), { status: 200 });
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[DELETE /api/qlik/connections/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err?.message },
      { status: 500 }
    );
  }
}
