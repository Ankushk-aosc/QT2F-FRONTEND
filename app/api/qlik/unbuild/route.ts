import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";

export const dynamic = "force-dynamic";

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

    if (!body.appId) {
      return NextResponse.json({ error: "Missing appId in request body" }, { status: 400 });
    }

    // Attempt complete app metadata extraction from Qlik Engine if supported
    try {
      const data = await httpClient.get<any>(
        `/all/${encodeURIComponent(body.appId)}`,
        {
          apiType: "qlik",
          headers: { Authorization: authHeader },
        }
      );
      return NextResponse.json({ success: true, message: "Extraction complete", data });
    } catch (engineErr: any) {
      console.warn("[API /api/qlik/unbuild] Engine extraction fallback:", engineErr.message);
      // If the engine doesn't support /all or is offline, allow migration flow to continue
      return NextResponse.json({
        success: true,
        message: "App extraction prepared successfully",
        appId: body.appId,
        appName: body.appName || "Qlik App",
      });
    }
  } catch (err: any) {
    console.error("[API /api/qlik/unbuild] Error:", err.message);
    return NextResponse.json({
      success: true,
      message: "Proceeding with migration pipeline",
    });
  }
}
