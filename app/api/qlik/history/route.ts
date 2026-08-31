import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const query = new URLSearchParams();
    searchParams.forEach((value, key) => {
      query.set(key, value);
    });

    const headers: Record<string, string> = {};
    if (authHeader) headers["Authorization"] = authHeader;

    let data: any = null;

    // 1. Primary: Call Semantic Kernel directly (SEMANTIC_KERNEL_URL/run-history)
    try {
      data = await httpClient.get<any>(`/run-history?${query.toString()}`, {
        apiType: "semantic",
        headers,
      });
    } catch (skErr: any) {
      console.warn("[API /api/qlik/history] Semantic Kernel /run-history route failed, trying fallback:", skErr.message);
    }

    // 2. Fallback to records host if SK route fails or returns empty
    if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === "object" && !data.data && !data.runs && !data.items)) {
      const logsQuery = new URLSearchParams(query);
      if (email && !logsQuery.has("email_id")) {
        logsQuery.set("email_id", email);
      }
      const candidateEndpoints = [
        `/run-history?${logsQuery.toString()}`,
        `/api/records/semantic-kernel?${logsQuery.toString()}`,
        `/api/records/run-history?${logsQuery.toString()}`,
      ];

      for (const endpoint of candidateEndpoints) {
        try {
          data = await httpClient.get<any>(endpoint, {
            apiType: "logs",
            headers,
          });
          if (data && (Array.isArray(data) ? data.length > 0 : (data.runs?.length > 0 || data.data?.length > 0 || data.items?.length > 0))) {
            break;
          }
        } catch {
          // try next
        }
      }
    }

    const items = Array.isArray(data) ? data : (data?.data || data?.runs || data?.items || []);
    return NextResponse.json(items);
  } catch (err: any) {
    console.warn("[API /api/qlik/history] Error:", err.message);
    return NextResponse.json([]);
  }
}

