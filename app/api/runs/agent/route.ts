import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import {
  RECORDS_PATHS,
  agentPath,
  type AgentName,
  type RunScope,
} from "@/lib/api/runContract";

export const dynamic = "force-dynamic";

/**
 * Agent actions and agent logs for one app within one run:
 *
 *   GET /agent-actions?run_id=&workspace_id=&app_id=&agent_name=
 *   GET /agent-logs?run_id=&workspace_id=&app_id=&agent_name=
 *
 * Selected with `?kind=actions|logs`. Identical query shape, so one route.
 *
 * Overlaps with /api/activities, which serves the same agent-actions endpoint
 * for the store-driven callers. This route additionally exposes agent-logs,
 * which /api/activities does not.
 */

const KIND_PATHS = {
  actions: RECORDS_PATHS.AGENT_ACTIONS,
  logs: RECORDS_PATHS.AGENT_LOGS,
} as const;

type Kind = keyof typeof KIND_PATHS;

const AGENT_NAMES: readonly AgentName[] = [
  "Assessment",
  "Parsing",
  "Mapping",
  "ReportGeneration",
  "Validation",
];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") as Kind | null;
    const agentName = searchParams.get("agent_name") as AgentName | null;
    const appId = searchParams.get("app_id");
    const workspaceId = searchParams.get("workspace_id");
    const runId = searchParams.get("run_id");

    if (!kind || !(kind in KIND_PATHS)) {
      return NextResponse.json(
        { error: `kind must be one of: ${Object.keys(KIND_PATHS).join(", ")}` },
        { status: 400 }
      );
    }
    if (!agentName || !AGENT_NAMES.includes(agentName)) {
      return NextResponse.json(
        { error: `agent_name must be one of: ${AGENT_NAMES.join(", ")}` },
        { status: 400 }
      );
    }
    const required = { app_id: appId, workspace_id: workspaceId, run_id: runId };
    for (const [key, value] of Object.entries(required)) {
      if (!value) {
        return NextResponse.json({ error: `${key} is required` }, { status: 400 });
      }
    }

    const scope: RunScope = {
      appId: appId!,
      workspaceId: workspaceId!,
      runId: runId!,
    };

    const data = await httpClient.get<unknown>(
      agentPath(KIND_PATHS[kind], scope, agentName),
      { apiType: "logs" }
    );

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/runs/agent] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch agent data" },
      { status: err?.status || 500 }
    );
  }
}
