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
    // LOGS_API_BASE is ".../api". The real aggregate lives at
    // /api/records/monitoring-summary and already returns exactly the shape
    // MonitoringService expects (total_runs, total_workbooks, completed,
    // failed, in_progress, pending, filters_applied).
    const targetUrl = new URL(`${baseUrl}/records/monitoring-summary`);

    if (email_id) targetUrl.searchParams.append("email_id", email_id);
    if (project_id) targetUrl.searchParams.append("project_id", project_id);
    if (status) targetUrl.searchParams.append("status", status);
    if (search) targetUrl.searchParams.append("search", search);
    if (created_on) targetUrl.searchParams.append("created_on", created_on);
    if (created_from) targetUrl.searchParams.append("created_from", created_from);
    if (created_to) targetUrl.searchParams.append("created_to", created_to);

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Backend returned ${response.status}`, details: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch monitoring summary", details: getErrorMessage(err) },
      { status: 500 }
    );
  }
}