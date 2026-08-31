


// app/api/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || searchParams.get("email_id");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const query = new URLSearchParams({ email_id: email });
    for (const [key, value] of searchParams.entries()) {
      if (key === "email" || key === "email_id") continue;
      query.set(key === "limit" ? "page_size" : key, value);
    }

    const headers: Record<string, string> = {};
    if (authHeader) headers["Authorization"] = authHeader;

    let data: any = null;
    const candidateEndpoints = [
      `/api/records/semantic-kernel?${query.toString()}`,
      `/run-history?${query.toString()}`,
      `/api/records/run-history?${query.toString()}`,
      `/records/run-history?${query.toString()}`,
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
        // try next endpoint
      }
    }

    return NextResponse.json(Array.isArray(data) ? data : (data?.runs || data?.data || data?.items || []));
  } catch (err: any) {
    console.warn("[API /api/history] Upstream fetch notice:", err.message);
    return NextResponse.json([]);
  }
}