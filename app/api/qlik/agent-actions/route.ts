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
    const folderName = searchParams.get("folderName");
    const agentName = searchParams.get("agentName");

    if (!folderName || !agentName) {
      return NextResponse.json({ error: "Missing folderName or agentName parameters" }, { status: 400 });
    }

    // Try fetching real activity records from Semantic Kernel / MongoDB
    try {
      const activities = await httpClient.get<any>(
        `/agent-actions?run_id=${encodeURIComponent(folderName)}`,
        {
          apiType: "semantic",
          headers: { Authorization: authHeader },
        }
      );

      const items = Array.isArray(activities) ? activities : (activities?.data || []);
      if (Array.isArray(items) && items.length > 0) {
        const aliases: Record<string, string[]> = {
          assessment: ["assessment", "assessmentagent", "assessment agent"],
          parsing: ["parsing", "parser", "parsingagent", "parseragent", "parsing agent", "parser agent"],
          mapping: ["mapping", "mapper", "mappingagent", "mapperagent", "mapping agent", "mapper agent"],
          generation: ["generation", "generationagent", "reportgeneration", "report generation", "report generation agent"],
          reportgeneration: ["generation", "generationagent", "reportgeneration", "report generation", "report generation agent"],
          validation: ["validation", "validationagent", "migration validation", "migration validation agent"],
        };
        const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const accepted = aliases[normalize(agentName)] || [normalize(agentName)];
        const filtered = items.filter((a: any) => {
          const value = normalize(String(a.agent_name || a.agent || ""));
          return accepted.some((alias) => normalize(alias) === value);
        });
        if (filtered.length > 0) {
          return NextResponse.json(filtered, { status: 200 });
        }
      }
    } catch {
      // Graceful fallback to synthesized execution log
    }

    // Never invent execution history. An empty response means that the
    // backend has not written actions for this stage yet.
    return NextResponse.json([], { status: 200 });
  } catch (err: any) {
    console.error("[API /api/qlik/agent-actions] Error:", err.message);
    const status = err.status || 500;
    return NextResponse.json({ error: err.message || "Failed to fetch agent actions" }, { status });
  }
}
