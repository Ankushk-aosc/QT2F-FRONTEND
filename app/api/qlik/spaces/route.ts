import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await httpClient.get<any>("/getSpaces", {
      apiType: "qlik",
      headers: { Authorization: authHeader },
    });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/spaces] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch spaces" }, { status });
  }
}
