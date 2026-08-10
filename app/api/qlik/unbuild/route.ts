import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }

    if (!body.appId || !body.appName) {
      return NextResponse.json({ error: "Missing appId or appName in request body" }, { status: 400 });
    }

    const data = await httpClient.post<any>(
      "/unbuildApp",
      { appId: body.appId, appName: body.appName },
      {
        apiType: "qlik",
        headers: { Authorization: authHeader },
      }
    );
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[API /api/qlik/unbuild] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to unbuild app" }, { status });
  }
}
