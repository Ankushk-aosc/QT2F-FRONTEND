// app/api/records/data-layer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-handler";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project_id = searchParams.get("project_id");
    const run_id = searchParams.get("run_id");
    const workbook_id = searchParams.get("workbook_id");

    if (!project_id || !run_id || !workbook_id) {
      return NextResponse.json(
        { error: "Missing required fields: project_id, run_id, workbook_id" },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Authorization header" },
        { status: 401 }
      );
    }

    const logsBase = process.env.LOGS_API_BASE;
    if (!logsBase) {
      return NextResponse.json(
        { error: "Server configuration error: LOGS_API_BASE missing" },
        { status: 500 }
      );
    }

    const baseUrl = logsBase.replace(/\/$/, "");
    const targetUrl = new URL(`${baseUrl}/data-layer`); // Based on /api/records base

    targetUrl.searchParams.append("project_id", project_id);
    targetUrl.searchParams.append("run_id", run_id);
    targetUrl.searchParams.append("workbook_id", workbook_id);

    console.log(`[API records/data-layer] Forwarding to: ${targetUrl.toString()}`);

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        {
          error: `Backend returned ${response.status}`,
          status: response.status,
          details: errorBody || "No details available",
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (err: any) {
    console.error("[API records/data-layer] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch data layer results",
        details: getErrorMessage(err),
      },
      { status: 500 }
    );
  }
}
