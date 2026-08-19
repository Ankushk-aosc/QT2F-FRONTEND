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
    const folder = searchParams.get("folder");

    if (!folder) {
      return NextResponse.json({ error: "Folder is required" }, { status: 400 });
    }

    // Hit the QLIK MongoDB for run-history of a folder
    try {
      const data = await httpClient.get<any>(`/run-history/${encodeURIComponent(folder)}`, {
        apiType: "qlik-mongo",
        headers: { Authorization: authHeader },
      });
      return NextResponse.json(data);
    } catch (err: any) {
      console.warn("[API /api/qlik/history-by-folder] qlik-mongo query failed, trying logs fallback:", err.message);
      try {
        const fallbackData = await httpClient.get<any>(
          `/records/run-history?folder_name=${encodeURIComponent(folder)}`,
          {
            apiType: "logs",
            headers: { Authorization: authHeader },
          }
        );
        return NextResponse.json(fallbackData);
      } catch {
        return NextResponse.json([]);
      }
    }
  } catch (err: any) {
    console.error("[API /api/qlik/history-by-folder] Error:", err.message);
    return NextResponse.json([]);
  }
}
