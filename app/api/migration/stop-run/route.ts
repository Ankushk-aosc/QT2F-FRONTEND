import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import { SK_PATHS, type StopRunRequest } from "@/lib/api/runContract";

export const dynamic = "force-dynamic";

/**
 * Stops an in-flight run: POST {SK}/qlik/stop-run with { run_id }.
 *
 * Distinct from the older app/api/migration/cancel/[runId] route, which posts
 * to the SK host's `/cancel/{runId}` with the id in the path and no body. That
 * is the previous generation of this call; this route is the one that matches
 * the current contract. Both are left in place until the callers of
 * recordsService.cancelMigration() are moved over.
 */
export async function POST(req: NextRequest) {
  try {
    // Matches the start route and the older cancel route: the SK host
    // authenticates this call, so fail fast rather than upstream.
    if (!req.headers.get("Authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const runId = (body as StopRunRequest | null)?.run_id;

    if (!runId || typeof runId !== "string" || !runId.trim()) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    const payload: StopRunRequest = { run_id: runId };
    console.log(`[API /api/migration/stop-run] Stopping run ${runId}`);

    const data = await httpClient.post<unknown>(SK_PATHS.STOP_RUN, payload, {
      apiType: "semantic",
    });

    return NextResponse.json({ run_id: runId, raw: data }, { status: 200 });
  } catch (err: any) {
    console.error("[API /api/migration/stop-run] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message ?? "Failed to stop run" },
      { status: err?.status || 500 }
    );
  }
}
