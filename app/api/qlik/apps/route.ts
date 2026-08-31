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
    const spaceId = searchParams.get("spaceId");
    if (!spaceId) {
      return NextResponse.json({ error: "Missing spaceId parameter" }, { status: 400 });
    }

    const sourceType = searchParams.get("source_type") || "cloud";
    const connectionId = searchParams.get("connection_id") || "";

    let qlikApiKey = "";

    // 1. If connectionId is passed, try to fetch connection details from records DB
    if (connectionId) {
      try {
        const connRes = await fetch(`https://mongo-db-k15s.onrender.com/qlik/${connectionId}`, {
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (connRes.ok) {
          const connData = await connRes.json();
          qlikApiKey = connData.api_key || connData.QLIK_API_KEY || "";
        }
      } catch (e) {
        console.warn("[API /api/qlik/apps] Failed to fetch connection details for ID:", connectionId, e);
      }
    }

    // 2. Fallback to default secret if specific connection key wasn't found
    if (!qlikApiKey) {
      try {
        const secretRes = await fetch("https://mongo-db-k15s.onrender.com/secrets/default_qlik_tenant-api-key", {
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (secretRes.ok) {
          const secretData = await secretRes.json();
          qlikApiKey = secretData.value || "";
        }
      } catch (e) {
        console.warn("[API /api/qlik/apps] Failed to fetch Qlik API key from secrets:", e);
      }
    }

    const qlikAuthHeader = qlikApiKey ? `Bearer ${qlikApiKey}` : authHeader;

    // 3. Try direct Qlik Base Engine
    try {
      const data = await httpClient.get<any>(`/getApps/${spaceId}`, {
        apiType: "qlik",
        headers: { Authorization: qlikAuthHeader },
      });
      if (Array.isArray(data)) {
        return NextResponse.json(data);
      }
    } catch (e: any) {
      console.warn(`[API /api/qlik/apps] Direct engine call failed for space ${spaceId}:`, e.message);
    }

    // 4. Try Semantic Kernel as fallback
    try {
      const query = new URLSearchParams({ space_id: spaceId, source_type: sourceType });
      if (connectionId) query.append("connection_id", connectionId);
      const data = await httpClient.get<any>(`/qlik/apps?${query.toString()}`, {
        apiType: "semantic",
        headers: { Authorization: authHeader },
      });
      if (Array.isArray(data)) {
        return NextResponse.json(data);
      }
    } catch (skErr: any) {
      console.warn(`[API /api/qlik/apps] Semantic Kernel route failed for space ${spaceId}:`, skErr.message);
    }

    return NextResponse.json([]);
  } catch (err: any) {
    console.error("[API /api/qlik/apps] Error:", err.message);
    return NextResponse.json([]);
  }
}

