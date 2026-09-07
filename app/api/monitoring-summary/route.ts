import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/error-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email_id = searchParams.get("email_id");
    const project_id = searchParams.get("project_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const created_on = searchParams.get("created_on");
    const created_from = searchParams.get("created_from");
    const created_to = searchParams.get("created_to");

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
    
    // First try the dedicated endpoint (either /api/records or /records depending on backend version)
    const targetUrl = new URL(`${baseUrl}/records/monitoring-summary`);
    if (email_id) targetUrl.searchParams.append("email_id", email_id);
    if (project_id) targetUrl.searchParams.append("project_id", project_id);
    if (status) targetUrl.searchParams.append("status", status);

    const targetUrl2 = new URL(`${baseUrl}/api/records/monitoring-summary`);
    if (email_id) targetUrl2.searchParams.append("email_id", email_id);
    if (project_id) targetUrl2.searchParams.append("project_id", project_id);

    let response = await fetch(targetUrl.toString(), { headers: { Authorization: authHeader } });
    
    if (!response.ok) {
        response = await fetch(targetUrl2.toString(), { headers: { Authorization: authHeader } });
    }

    if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
    }

    // If both fail, manually calculate the summary by pulling all runs from semantic-kernel
    console.warn("[API monitoring-summary] Dedicated endpoints 404'd, falling back to manual aggregation");
    const fallbackUrl = new URL(`${baseUrl}/records/semantic-kernel`);
    if (email_id) fallbackUrl.searchParams.append("email_id", email_id);
    if (project_id) fallbackUrl.searchParams.append("project_id", project_id);
    fallbackUrl.searchParams.append("page", "1");
    fallbackUrl.searchParams.append("page_size", "10000");

    const fallbackResponse = await fetch(fallbackUrl.toString(), {
        headers: { Authorization: authHeader, Accept: "application/json" }
    });

    if (!fallbackResponse.ok) {
        return NextResponse.json(
            { error: `Backend returned ${fallbackResponse.status}`, details: await fallbackResponse.text() },
            { status: fallbackResponse.status }
        );
    }

    const fallbackData = await fallbackResponse.json();
    const items = Array.isArray(fallbackData) ? fallbackData : (fallbackData.data || fallbackData.items || fallbackData.runs || fallbackData.records || fallbackData.result || []);

    let completed = 0;
    let failed = 0;
    let inProgress = 0;
    let pending = 0;

    for (const item of items) {
        const st = (item.overall_status || "").toLowerCase();
        if (st === "completed" || st === "success") completed++;
        else if (st === "failed" || st === "error") failed++;
        else if (st === "in progress" || st === "running") inProgress++;
        else if (st === "pending") pending++;
    }

    return NextResponse.json({
        email_id,
        total_runs: items.length,
        total_workbooks: items.length,
        completed,
        failed,
        in_progress: inProgress,
        pending
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch monitoring summary", details: getErrorMessage(err) },
      { status: 500 }
    );
  }
}