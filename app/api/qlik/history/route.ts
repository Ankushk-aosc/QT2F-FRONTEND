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
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const queryString = Array.from(searchParams.entries())
      .filter(([key]) => key !== "email")
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    const endpoint = `/run-history/by-email/${encodeURIComponent(email)}${queryString ? `?${queryString}` : ""}`;

    const data = await httpClient.get<any>(endpoint, {
      apiType: "sql",
      headers: { Authorization: authHeader },
    });
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/history] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch run history" }, { status });
  }
}
