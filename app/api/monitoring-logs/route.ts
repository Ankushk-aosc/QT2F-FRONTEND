// app/api/monitoring-logs/route.ts
// GET /api/monitoring-logs
// Proxy to LOGS_API_BASE/logs with optional project_id, workbook_id, and required run_id

import { getErrorMessage } from "@/lib/error-handler";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const project_id = searchParams.get("project_id");
        const workbook_id = searchParams.get("workbook_id");
        const run_id = searchParams.get("run_id");

        // ── Authorization ────────────────────────────────────────────────
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("[API monitoring-logs] Missing Authorization header");
            return NextResponse.json(
                { error: "Unauthorized: Missing Authorization header" },
                { status: 401 }
            );
        }

        // ── Required params ──────────────────────────────────────────────
        // ONLY run_id is strictly required by the Cosmos DB backend to fetch logs
        if (!run_id) {
            console.error("[API monitoring-logs] Missing required parameter: run_id");
            return NextResponse.json(
                { error: "Missing required field: run_id" },
                { status: 400 }
            );
        }

        // ── Build target URL ─────────────────────────────────────────────
        const logsBase = process.env.LOGS_API_BASE;
        if (!logsBase) {
            console.error("[API monitoring-logs] LOGS_API_BASE is not defined");
            return NextResponse.json(
                { error: "Server configuration error: LOGS_API_BASE missing" },
                { status: 500 }
            );
        }

        const baseUrl = logsBase.replace(/\/$/, "");
        // LOGS_API_BASE is ".../api"; the agent log feed is /records/monitoring-logs.
        const targetUrl = new URL(`${baseUrl}/records/monitoring-logs`);

        // Only append project_id and workbook_id if they actually exist and are not fallback strings
        if (project_id && project_id !== "Unknown Project" && project_id !== "Unknown") {
            targetUrl.searchParams.append("project_id", project_id);
        }

        if (workbook_id && workbook_id !== "Unknown") {
            targetUrl.searchParams.append("workbook_id", workbook_id);
        }

        targetUrl.searchParams.append("run_id", run_id);

        // Forward pagination and ordering parameters
        const limit = searchParams.get("limit");
        const pageSize = searchParams.get("page_size") || searchParams.get("pageSize");
        const order = searchParams.get("order");

        if (limit) targetUrl.searchParams.append("limit", limit);
        if (pageSize) targetUrl.searchParams.append("page_size", pageSize);
        if (order) targetUrl.searchParams.append("order", order);

        console.log(`[API monitoring-logs] Forwarding to: ${targetUrl.toString()}`);

        // ── Proxy request ────────────────────────────────────────────────
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        let response: Response;
        try {
            response = await fetch(targetUrl.toString(), {
                method: "GET",
                headers: {
                    Authorization: authHeader,
                    Accept: "application/json",
                },
                cache: "no-store",
                signal: controller.signal,
            });
        } catch (fetchErr: any) {
            clearTimeout(timeout);
            const reason =
                fetchErr.name === "AbortError"
                    ? "Request timed out (30s)"
                    : fetchErr.message || "fetch failed";
            console.warn(`[API monitoring-logs] Backend unreachable: ${reason}`);
            return NextResponse.json(
                { error: "Backend unreachable", details: reason },
                { status: 503 }
            );
        }
        clearTimeout(timeout);

        console.log(`[API monitoring-logs] Backend responded with status ${response.status}`);

        if (!response.ok) {
            let errorBody = "";
            try { errorBody = await response.text(); } catch { /* ignore */ }
            console.error("[API monitoring-logs] Backend error:", errorBody.substring(0, 800));
            return NextResponse.json(
                { error: `Backend returned ${response.status}`, details: errorBody || "No details" },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("[API monitoring-logs] Unexpected error:", err);
        return NextResponse.json(
            { error: "Failed to fetch monitoring logs", details: getErrorMessage(err) },
            { status: 500 }
        );
    }
}