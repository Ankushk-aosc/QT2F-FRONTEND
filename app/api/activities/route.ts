import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { RECORDS_PATHS } from "@/lib/api/runContract";
import { normalizeAgentActions } from "@/lib/agentActivity";

export const dynamic = "force-dynamic";

/**
 * Agent activity feed:
 *
 *   GET {RECORDS_BASE}/agent-actions?run_id=&workspace_id=&app_id=&agent_name=
 *
 * This route did not exist. agent.store's activity loader and
 * agentActivityService both call /api/activities, so every one of those
 * requests was a 404 -- the red rows in the Network panel. The store paginates
 * with limit/offset, so a single stage produced a burst of failures rather than
 * one.
 *
 * Parameter names come from the Tableau-era stores and are mapped onto the
 * current contract, the same aliasing the assessment and parsing routes use:
 *
 *   workbook_id | app_id       -> app_id
 *   project_id  | workspace_id -> workspace_id   (the QLIK SPACE)
 *   run_id, agent_name         -> passed through
 *   limit, offset              -> forwarded when present
 *
 * agent_name is not validated against the known set here: the callers supply it
 * verbatim and rejecting an unexpected value would turn a working feed into a
 * 400. Upstream is the authority on which names it serves.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const appId = searchParams.get("app_id") || searchParams.get("workbook_id");
    const workspaceId =
      searchParams.get("workspace_id") || searchParams.get("project_id");
    const runId = searchParams.get("run_id");
    const agentName = searchParams.get("agent_name");

    if (!runId) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    const query = new URLSearchParams();
    if (runId) query.set("run_id", runId);
    if (workspaceId) {
      query.set("workspace_id", workspaceId);
      query.set("project_id", workspaceId);
    }
    if (appId) {
      query.set("app_id", appId);
      query.set("workbook_id", appId);
    }
    if (agentName) query.set("agent_name", agentName);

    for (const key of ["limit", "offset"]) {
      const value = searchParams.get(key);
      if (value) query.set(key, value);
    }

    let data: any = null;

    // 1. Qlik Agent Actions API: {{SEMANTIC_KERNEL_URL}}/agent-actions?run_id=...
    try {
      data = await httpClient.get<unknown>(
        `/agent-actions?${query.toString()}`,
        { apiType: "semantic" }
      );
    } catch {
      try {
        data = await httpClient.get<unknown>(
          `/agent-actions?${query.toString()}`,
          { apiType: "logs" }
        );
      } catch {}
    }

    // 2. Tableau Agent Actions API: {{SEMANTIC_KERNEL_URL}}/api/records/activities?run_id=...
    if (!data || (Array.isArray(data) && data.length === 0)) {
      try {
        data = await httpClient.get<unknown>(
          `/api/records/activities?${query.toString()}`,
          { apiType: "semantic" }
        );
      } catch {
        try {
          data = await httpClient.get<unknown>(
            `/api/records/activities?${query.toString()}`,
            { apiType: "logs" }
          );
        } catch {}
      }
    }

    // 3. Fallback to RECORDS_PATHS.AGENT_ACTIONS
    if (!data || (Array.isArray(data) && data.length === 0)) {
      try {
        data = await httpClient.get<unknown>(
          `${RECORDS_PATHS.AGENT_ACTIONS}?${query.toString()}`,
          { apiType: "logs" }
        );
      } catch {}
    }

    return NextResponse.json(normalizeAgentActions(data || []), { status: 200 });
  } catch (err: any) {
    console.error("[API /api/activities] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch agent activities" },
      { status: err?.status || 500 }
    );
  }
}
