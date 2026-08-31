import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get("source_type") || "cloud";
    const connectionId = searchParams.get("connection_id") || "";

    let qlikApiKey = "";

    // 1. If connectionId is passed, try to fetch connection details from records DB
    if (connectionId) {
      try {
        const connData = await httpClient.get<any>(`/qlik/${connectionId}`, {
          apiType: "records",
          headers: { Authorization: authHeader },
        });
        qlikApiKey = connData?.api_key || connData?.QLIK_API_KEY || "";
      } catch (e: any) {
        console.warn("[API /api/qlik/spaces] Failed to fetch connection details for ID:", connectionId, e.message);
      }
    }

    // 2. Fallback to default secret if specific connection key wasn't found
    if (!qlikApiKey) {
      try {
        const secretData = await httpClient.get<any>("/secrets/default_qlik_tenant-api-key", {
          apiType: "records",
          forwardHeaders: false,
        });
        qlikApiKey = secretData?.value || "";
      } catch (e: any) {
        console.warn("[API /api/qlik/spaces] Failed to fetch Qlik API key from secrets:", e.message);
      }
    }

    // 3. Try direct Qlik Base Engine with API key or Auth Header
    const qlikAuthHeader = qlikApiKey ? `Bearer ${qlikApiKey}` : authHeader;

    try {
      const data = await httpClient.get<any>("/getSpaces", {
        apiType: "qlik",
        headers: qlikAuthHeader ? { Authorization: qlikAuthHeader } : undefined,
      });

      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch (e: any) {
      console.warn("[API /api/qlik/spaces] Direct engine getSpaces call failed:", e.message);
    }

    // 4. Try Semantic Kernel route as secondary fallback
    try {
      const query = new URLSearchParams({ source_type: sourceType });
      if (connectionId) query.append("connection_id", connectionId);
      const data = await httpClient.get<any>(`/qlik/spaces?${query.toString()}`, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (Array.isArray(data) && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch (skErr: any) {
      console.warn("[API /api/qlik/spaces] Semantic Kernel route failed:", skErr.message);
    }

    // Absolute fallback: Return default personal space so UI dropdown is never stuck
    return NextResponse.json([
      { id: "personal", name: "Personal Space" },
    ]);
  } catch (err: any) {
    console.error("[API /api/qlik/spaces] Outer Error:", err.message);
    return NextResponse.json([
      { id: "personal", name: "Personal Space" },
    ]);
  }
}
