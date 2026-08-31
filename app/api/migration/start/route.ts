import { NextRequest, NextResponse } from "next/server";
import { httpClient } from "@/lib/api/httpClient";
import {
  SK_PATHS,
  extractItemsDetails,
  extractRunId,
  type InvokeBatchItem,
  type InvokeBatchRequest,
  type ProcessSpaceRequest,
  type StartRunResponse,
} from "@/lib/api/runContract";

export const dynamic = "force-dynamic";

/**
 * Starts a migration run on the Semantic Kernel host.
 *
 * One handler serves both start endpoints so the scope -> endpoint decision
 * lives in exactly one place:
 *
 *   scope "apps"   -> POST /invoke-batch       { items: [{app_id, workspace_id}] }
 *   scope "spaces" -> POST /qlik/process-space { workspace_id: [...] }
 *
 * Both take the same envelope (email, fabric_access_token, and optionally
 * fabric_group_id / department_repo / deployment_type); only the selection
 * field differs. Splitting these into two routes would duplicate that envelope
 * and the validation below.
 *
 * This must be a server route: SEMANTIC_KERNEL_URL is not a NEXT_PUBLIC_ var,
 * so the browser cannot reach the SK host itself.
 */

const bad = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

/** Strips the bearer before anything reaches a log sink. */
const redact = (payload: Record<string, unknown>) => ({
  ...payload,
  fabric_access_token: payload.fabric_access_token ? "<redacted>" : undefined,
});

export async function POST(req: NextRequest) {
  let endpoint = "";
  try {
    // The SK host authenticates these calls, and httpClient forwards this
    // header upstream. Checking it here turns a missing bearer into an
    // immediate 401 instead of an opaque upstream rejection -- which matters
    // because the client has already minted a Fabric token (and possibly
    // shown an MFA prompt) by the time it calls us.
    if (!req.headers.get("Authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("A JSON body is required");

    const {
      scope,
      email,
      fabric_access_token,
      fabric_group_id,
      connection_id,
      department_repo,
      deployment_type,
      items,
      workspace_id,
    } = body as Record<string, any>;

    if (!email) return bad("email is required");
    // Required by both endpoints. Rejecting here gives a traceable 400 rather
    // than an opaque upstream failure once the run is already accepted.
    if (!fabric_access_token) return bad("fabric_access_token is required");

    const envelope = {
      email,
      fabric_access_token,
      ...(fabric_group_id ? { fabric_group_id } : {}),
      ...(connection_id ? { connection_id } : {}),
      ...(department_repo ? { department_repo } : {}),
      ...(deployment_type ? { deployment_type } : {}),
    };

    let payload: InvokeBatchRequest | ProcessSpaceRequest;

    if (scope === "apps") {
      if (!Array.isArray(items) || items.length === 0) {
        return bad("items must be a non-empty array when scope is 'apps'");
      }
      // workspace_id here is the QLIK SPACE the app belongs to, never the
      // Fabric workspace -- see InvokeBatchItem in lib/api/runContract.ts.
      const malformed = (items as InvokeBatchItem[]).findIndex(
        (item) => !item?.app_id || !item?.workspace_id
      );
      if (malformed !== -1) {
        return bad(`items[${malformed}] needs both app_id and workspace_id`);
      }
      endpoint = SK_PATHS.INVOKE_BATCH;
      payload = { ...envelope, items } as InvokeBatchRequest;
    } else if (scope === "spaces" || scope === "sites") {
      if (!Array.isArray(workspace_id) || workspace_id.length === 0) {
        return bad("workspace_id must be a non-empty array when scope is 'spaces' or 'sites'");
      }
      if ((workspace_id as unknown[]).some((id) => typeof id !== "string" || !id)) {
        return bad("workspace_id must contain only non-empty space ids");
      }
      endpoint = SK_PATHS.PROCESS_SPACE;
      payload = { ...envelope, workspace_id } as ProcessSpaceRequest;
    } else {
      return bad(`Unknown scope '${scope}' -- expected 'apps', 'spaces', or 'sites'`);
    }

    console.log(
      `[API /api/migration/start] -> ${endpoint}`,
      JSON.stringify(redact(payload as unknown as Record<string, unknown>))
    );

    const data = await httpClient.post<StartRunResponse>(endpoint, payload, {
      apiType: "semantic",
    });

    // A 200 carrying success:false is still a failed start. Surfaced as an
    // error so it cannot be mistaken for a queued run.
    if (data?.success === false) {
      return NextResponse.json(
        { error: data.message || "The backend rejected the run request.", raw: data },
        { status: 502 }
      );
    }

    const runId = extractRunId(data);
    if (!runId) {
      console.warn(
        "[API /api/migration/start] No run id found in start response:",
        JSON.stringify(data)?.slice(0, 500)
      );
    }

    // The resolved app list. Under the "spaces" scope this is the only place
    // the expanded apps are reported, and that endpoint's response shape has
    // never been confirmed against a real payload (unlike /invoke-batch's,
    // which is) -- extractItemsDetails tries the shapes a backend commonly
    // uses instead of a flat `items_details` array and logs the raw keys if
    // none of them match, so a still-wrong guess is diagnosable rather than
    // silently empty.
    const itemsDetails = extractItemsDetails(data, { scope });
    if (itemsDetails.length === 0 && scope === "spaces") {
      console.warn(
        `[API /api/migration/start] spaces scope resolved to zero apps for run ${runId ?? "?"}. Raw response:`,
        JSON.stringify(data)?.slice(0, 2000)
      );
    }

    return NextResponse.json(
      {
        run_id: runId,
        run_no: data?.run_no ?? null,
        message: data?.message ?? null,
        items_queued: data?.items_queued ?? itemsDetails.length,
        items_details: itemsDetails,
        endpoint,
        raw: data,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[API /api/migration/start] ${endpoint} failed:`, err?.message);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start migration run" },
      { status: err?.status || 500 }
    );
  }
}
