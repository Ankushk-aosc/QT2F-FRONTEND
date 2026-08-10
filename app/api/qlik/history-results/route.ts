import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const folder = searchParams.get("folder");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!type || !folder) {
      return NextResponse.json({ error: "Type and folder are required" }, { status: 400 });
    }

    const validTypes = ["assessment", "parsing", "mapping", "report-generation"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const endpoint = `/${type}/${encodeURIComponent(folder)}`;

    const data = await httpClient.get<any>(endpoint, {
      apiType: "sql",
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/history-results] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || `Failed to fetch ${type} results` }, { status });
  }
}
