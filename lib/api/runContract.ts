/**
 * Single source of truth for the Semantic Kernel + records "run" contract.
 *
 * Paths, payload shapes and query builders only -- deliberately NO env access,
 * so this module is safe to import from both server route handlers and client
 * components. Base URLs live in lib/env.ts and are reached through httpClient's
 * `apiType`:
 *
 *   "semantic" -> SEMANTIC_KERNEL_URL   start / stop a run
 *   "logs"     -> API_BASE_URL          records: status, history, results, logs
 *
 * SEMANTIC_KERNEL_URL is server-only (not NEXT_PUBLIC_*), so the browser can
 * never call the SK host directly -- every start/stop goes through a Next route
 * handler under app/api/. The records host does have a NEXT_PUBLIC_ base, but we
 * proxy it too so the Authorization bearer is attached in one place.
 */

// ─── Hosts ──────────────────────────────────────────────────────────────────

/** Semantic Kernel host (apiType: "semantic"). */
export const SK_PATHS = {
  /** Start a run for one or more specific Qlik apps. */
  INVOKE_BATCH: "/invoke-batch",
  /** Start a run for one or more whole Qlik spaces. */
  PROCESS_SPACE: "/qlik/process-space",
  /** Stop an in-flight run. */
  STOP_RUN: "/qlik/stop-run",
} as const;

/** Records / Cosmos host (apiType: "logs"). */
export const RECORDS_PATHS = {
  /** GET current value; PATCH { status } to toggle partial processing. */
  INTERACTIVE_STATUS: "/api/records/interactive-status",
  /** Run history, and the poll source for the monitoring agent. */
  RUN_HISTORY: "/api/records/semantic-kernel",
  ASSESSMENT: "/assessment",
  PARSING: "/parsing",
  MAPPING: "/mapping",
  /**
   * Note the path: upstream serves report generation under "/report-generation"
   * even though the client calls the stage "generation" everywhere else. The
   * segment list in app/api/history-results/route.ts is the confirmation.
   */
  REPORT_GENERATION: "/report-generation",
  VALIDATION: "/validation",
  AGENT_ACTIONS: "/agent-actions",
  AGENT_LOGS: "/agent-logs",
} as const;

// ─── Run identity ───────────────────────────────────────────────────────────

export type AgentName =
  | "Assessment"
  | "Parsing"
  | "Mapping"
  | "ReportGeneration"
  | "Validation";

/**
 * Which start endpoint a run uses, driven by the Migration Scope control.
 *   "apps"   -> pick one space, then one or more apps in it -> INVOKE_BATCH
 *   "spaces" -> pick one or more whole spaces               -> PROCESS_SPACE
 *   "sites"  -> the whole tenant, no picker (T2F's "Site (All Projects)")  ->
 *               UI-only for now. SK_PATHS has no third endpoint for this, so
 *               QlikMigrationDashboard keeps the Migrate button disabled
 *               whenever it's selected until a backend contract exists.
 */
export type MigrationScope = "apps" | "spaces" | "sites";

/** Identifies one app inside one run, for result / action / log reads. */
export interface RunScope {
  appId: string;
  /** Qlik space id -- see the warning on InvokeBatchItem.workspace_id. */
  workspaceId: string;
  runId: string;
}

// ─── Start payloads ─────────────────────────────────────────────────────────

/**
 * One app to migrate.
 *
 * `workspace_id` is the QLIK SPACE the app lives in -- either a 24-char space
 * id (e.g. "681192c4a97184a58e512e25") or the literal "personal". It is NOT the
 * Fabric workspace: Fabric is addressed separately via `fabric_group_id`, which
 * is a GUID. Confusing the two is the easiest way to break a run, because both
 * fields are plain strings and the backend cannot tell them apart.
 */
export interface InvokeBatchItem {
  app_id: string;
  workspace_id: string;
}

/** Fields common to both start endpoints. */
interface StartRequestBase {
  email: string;
  /** Fabric bearer minted in the browser. Never sourced server-side. */
  fabric_access_token: string;
  /** Target Fabric workspace GUID. */
  fabric_group_id?: string;
  department_repo?: string;
  deployment_type?: string;
  /** The saved Qlik connection to run against, e.g. "conn-85ae289a4110". */
  connection_id?: string;
}

/** POST {SK}/invoke-batch -- one or more specific apps. */
export interface InvokeBatchRequest extends StartRequestBase {
  items: InvokeBatchItem[];
}

/** POST {SK}/qlik/process-space -- one or more whole spaces. */
export interface ProcessSpaceRequest extends StartRequestBase {
  /** Qlik space ids. "personal" is a valid entry. */
  workspace_id: string[];
}

/** POST {SK}/qlik/stop-run */
export interface StopRunRequest {
  run_id: string;
}

/**
 * One app resolved into a run.
 *
 * The backend echoes these back on start with the names it looked up, so this
 * doubles as the answer to a question the client cannot resolve itself: which
 * apps a space actually expanded into under the "spaces" scope. Use it to seed
 * per-app progress rows rather than guessing from the selection.
 */
export interface StartRunItemDetail {
  /** Qlik space id, e.g. "681192c4a97184a58e512e25" or "personal". */
  workspace_id: string;
  workspace_name?: string;
  app_id: string;
  app_name?: string;
}

/**
 * Response to a start call. Confirmed against a live POST /invoke-batch:
 *
 *   { success, message, run_no: "R-16", run_id: "<uuid>",
 *     items_queued: 2, items_details: [{workspace_id, workspace_name,
 *                                       app_id, app_name}, ...] }
 *
 * Every field stays optional and the index signature is kept: /qlik/process-space
 * has not been confirmed to answer identically, and a missing field should
 * degrade one feature rather than throw.
 */
export interface StartRunResponse {
  success?: boolean;
  message?: string;
  /** Human-facing run label, e.g. "R-16". Distinct from the run_id uuid. */
  run_no?: string;
  run_id?: string;
  items_queued?: number;
  items_details?: StartRunItemDetail[];
  [key: string]: unknown;
}

/**
 * Pull the run id out of a start response.
 *
 * /invoke-batch returns it as a top-level `run_id`, which the first branch
 * handles. The alternate spellings and the nesting walk remain as a safety net
 * for /qlik/process-space, whose response shape is still unconfirmed -- losing
 * the id silently would leave a real run untrackable.
 *
 * Returns null rather than throwing so callers decide whether that is fatal.
 */
export function extractRunId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const direct = record.run_id ?? record.runId ?? record.runID;
  if (typeof direct === "string" && direct.trim()) return direct;

  // Some backends wrap the result: { data: {...} } / { result: {...} }.
  for (const key of ["data", "result", "run"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const found = extractRunId(nested);
      if (found) return found;
    }
  }
  return null;
}

/**
 * A raw candidate item is only trusted once it structurally looks like one --
 * an app_id present, under any of the spellings a backend might use. Guards
 * to the raw record shape (not `StartRunItemDetail`, which is the already-
 * normalized field names) since the whole point is accepting entries that
 * use a different spelling before `normalizeItemDetail` reconciles it.
 */
function isLikelyItemDetail(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const appId = r.app_id ?? r.appId ?? r.id;
  return typeof appId === "string" && appId.trim().length > 0;
}

function normalizeItemDetail(value: Record<string, unknown>, fallbackWorkspaceId?: string): StartRunItemDetail {
  const appId = (value.app_id ?? value.appId ?? value.id) as string;
  const workspaceId = (value.workspace_id ?? value.workspaceId ?? value.space_id ?? fallbackWorkspaceId ?? "") as string;
  return {
    app_id: appId,
    workspace_id: workspaceId,
    app_name: (value.app_name ?? value.appName ?? value.name) as string | undefined,
    workspace_name: (value.workspace_name ?? value.workspaceName ?? value.space_name) as string | undefined,
  };
}

/**
 * Pull the resolved app list out of a start response.
 *
 * /invoke-batch is confirmed to answer with a flat `items_details` array (see
 * StartRunResponse's doc comment) -- the direct branch below handles that.
 * /qlik/process-space's *start* response shape has never been confirmed
 * against a real payload, but the run-status record this same backend
 * produces for a space run (GET /api/records/semantic-kernel?run_id=...,
 * confirmed live 2026-08-19) nests the per-app list at
 * `payload.processed_items[]`, shaped `{app_id, workspace_id, workspace_name,
 * app_name, connection_id, steps, final_status, ...}` -- a near-exact match
 * for StartRunItemDetail plus extra per-app progress fields this function
 * ignores. `processed_items` is checked first as the most likely real name;
 * the rest of the list and the per-space grouping below stay as fallbacks in
 * case the *start* response (a different call from the *status* one this was
 * confirmed against) still shapes it differently. Every candidate item is
 * validated (must carry an app_id) before being accepted, so a wrong guess
 * degrades to "found nothing" rather than seeding garbage app ids.
 *
 * Logs the raw top-level keys whenever nothing is found, specifically so a
 * real "spaces" scope response that still doesn't match any of these shapes
 * is diagnosable from server logs instead of failing silently -- see the
 * 2026-08-19 Whole Space investigation.
 */
export function extractItemsDetails(payload: unknown, context?: { scope?: string }): StartRunItemDetail[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;

  // 1. Flat array under any of the plausible key spellings. processed_items
  // first -- confirmed as the real key name on this backend's run-status
  // record for a space run, so most likely to also be what the start
  // response itself uses.
  for (const key of ["processed_items", "processedItems", "items_details", "itemsDetails", "items", "apps", "expanded_apps", "expandedApps", "queued_apps", "queued_items"]) {
    const candidate = record[key];
    if (Array.isArray(candidate) && candidate.length > 0 && candidate.every(isLikelyItemDetail)) {
      return candidate.map((item) => normalizeItemDetail(item as Record<string, unknown>));
    }
  }

  // 2. Per-space grouping: each group carries its own workspace_id plus a
  // nested app list under one of the same plausible spellings.
  for (const groupKey of ["spaces", "workspaces", "results"]) {
    const groups = record[groupKey];
    if (!Array.isArray(groups)) continue;
    const flattened: StartRunItemDetail[] = [];
    for (const groupRaw of groups) {
      if (!groupRaw || typeof groupRaw !== "object") continue;
      const group = groupRaw as Record<string, unknown>;
      const groupWorkspaceId = (group.workspace_id ?? group.workspaceId ?? group.space_id) as string | undefined;
      for (const key of ["apps", "items", "items_details"]) {
        const nested = group[key];
        if (Array.isArray(nested)) {
          flattened.push(
            ...nested.filter(isLikelyItemDetail).map((item) => normalizeItemDetail(item as Record<string, unknown>, groupWorkspaceId))
          );
        }
      }
    }
    if (flattened.length > 0) return flattened;
  }

  // 3. Wrapped result: { payload: {...} } (confirmed shape of this backend's
  // own run-status record) / { data: {...} } / { result: {...} }.
  for (const key of ["payload", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const found = extractItemsDetails(nested, context);
      if (found.length > 0) return found;
    }
  }

  console.warn(
    `[extractItemsDetails] No app list found in ${context?.scope ?? "?"}-scope start response. Top-level keys:`,
    Object.keys(record)
  );
  return [];
}

// ─── Run status ─────────────────────────────────────────────────────────────

/**
 * Progress counters on a run record from GET /api/records/semantic-kernel.
 *
 * The live Qlik records host sends the run size as `total_apps`.
 * `total_workbooks` is the pre-Qlik spelling, inherited from the Tableau
 * service these endpoints grew out of, and older records still carry it --
 * app/Mapper/runHistoryMapper.ts has read both for exactly that reason. This
 * contract only knew the Tableau name, which is why every read of the run size
 * here resolved to undefined against a real record.
 */
export interface RunRecordCounters {
  total_apps?: number;
  total_workbooks?: number;
  total_migrated?: number;
  total_failed?: number;
  total_cancelled?: number;
  total_pending?: number;
  total_generation_completed?: number;
  total_validation_skipped?: number;
}

/** The run size, under whichever spelling this record uses. */
export function runTotalApps(counters: RunRecordCounters | null | undefined): number {
  return counters?.total_apps ?? counters?.total_workbooks ?? 0;
}

export interface RunRecord extends RunRecordCounters {
  run_id?: string;
  run_no?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * The records host is inconsistent about whether a list comes back bare or
 * wrapped, and under which key. Accepts every form seen in the wild rather than
 * betting on one and silently reading an empty list.
 *
 * Mirrors the unwrapping already inlined in dashboard.store's
 * fetchActiveRunStats -- kept here so the next caller does not re-derive it.
 */
export function unwrapRecordList<T = RunRecord>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "items", "records", "runs"]) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  return [];
}

/**
 * Statuses that mean the run is still going.
 *
 * The same four monitoring.store's fetchActiveRuns filters Active Run on, and
 * the authority in both places: anything else is a finished run. The records
 * host reports a partial run as "Ran till parsing", which is terminal but is
 * neither a failure nor one of the usual success words, so a positive list of
 * "still running" values is the only test that classifies it correctly.
 */
const IN_FLIGHT_STATUSES = ["running", "processing", "pending", "paused"];

/**
 * Whether a run has finished: a terminal status, or nothing left pending.
 *
 * Guarding on the run size matters because a record polled in the moment
 * between start and enqueue reads as all-zero, which would otherwise look
 * complete and stop the poll before the run ever began.
 */
export function isRunComplete(counters: RunRecordCounters | null | undefined): boolean {
  if (!counters) return false;

  const status = String((counters as RunRecord).status ?? "").trim().toLowerCase();

  // A stopped run keeps its unstarted apps pending -- upstream cancels the queue
  // rather than draining it -- so a pending-only test never fires and the status
  // poll runs forever against a run that is over. Treat a terminal status as
  // finished regardless of the counters.
  if (/cancel|stopped|abort|fail/.test(status)) return true;

  /*
   * A status the host has moved off "running" is finished, whatever it says.
   *
   * A partial run ends as "Ran till parsing", which matched none of the tests
   * that used to live here, so completion fell through to the counters -- and
   * those were being read under the wrong key (see runTotalApps), leaving the
   * run permanently in flight. Reading the status positively fixes the general
   * case: any future wording ("Ran till mapping", say) reads as finished on the
   * day it appears rather than hanging the UI until someone adds a regex.
   */
  if (status && !IN_FLIGHT_STATUSES.includes(status)) return true;

  const total = runTotalApps(counters);
  if (total <= 0) return false;
  return (counters.total_pending ?? 0) === 0;
}

// ─── Per-run result records ─────────────────────────────────────────────────

/**
 * Raw record as the records host returns it from /assessment/{app_id} and
 * /parsing/{app_id}. Confirmed live:
 *
 *   [ { id, run_id, workspace_id, app_id, assessment_result: {...} } ]
 *   [ { id, run_id, workspace_id, app_id, parsing_result:    {...} } ]
 *
 * Always a single-element array for a given (app_id, run_id) pair, with the
 * real content nested under a per-agent key.
 */
export interface RunResultRecord {
  id?: string;
  run_id?: string;
  workspace_id?: string;
  app_id?: string;
  assessment_result?: Record<string, unknown>;
  parsing_result?: Record<string, unknown>;
  mapping_result?: Record<string, unknown>;
  report_result?: Record<string, unknown>;
  validation_result?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Inner content key, per agent.
 *
 * `generation` reads `report_result`, not `generation_result` -- the upstream
 * record is keyed after the "report-generation" stage name. Confirmed by the
 * reads in components/Qlik-Migration-Dashboard/RunHistory (report_result) and
 * components/tabs/MigrationValidationView (validation_result).
 */
export const RESULT_KEYS = {
  assessment: "assessment_result",
  parsing: "parsing_result",
  mapping: "mapping_result",
  generation: "report_result",
  validation: "validation_result",
} as const;

export interface NormalizedRunResult extends RunResultRecord {
  /** Alias of app_id. The stores were written against Tableau's vocabulary. */
  workbook_id?: string;
  /** The unwrapped agent output. */
  payload?: Record<string, unknown>;
  /** Lifted from payload.status when the agent reports one. */
  status?: string;
}

/**
 * Flattens a result response into the shape the stores actually test for.
 *
 * Consumers (agent.store's fetchAssessmentData and its polling loop,
 * assessmentService, parsingService) all gate on `data.status` or
 * `data.payload` at the top level. The upstream response satisfies neither: it
 * is an array, and the content hides under assessment_result / parsing_result.
 * Left raw, every one of those callers silently discards a perfectly good
 * response -- which is why the assessment data never reached MigrationOverview.
 *
 * Returns null when the array is empty, meaning "no result yet". That is a
 * normal mid-run state, and null (rather than {}) keeps callers retrying
 * instead of caching an empty success.
 */
/**
 * The records host answers a not-yet-produced result with HTTP 200 and a
 * sentinel body, not a 404 and not an empty array -- confirmed live
 * 2026-08-19 against GET /assessment/{app_id} and /parsing/{app_id} with an
 * app_id that has no record yet:
 *
 *   { "message": "No record found for folder '<app_id>'" }
 *
 * None of the required AssessmentData/ParsingData fields (run_id,
 * workspace_id, app_id, or the per-agent result key) are present on it --
 * both schemas require all four. Without this check normalizeRunResult fell
 * through into "found a result": `inner` resolved to the sentinel itself and
 * `status` defaulted to "completed", so the poll loop cached
 * { message: "..." } as the app's assessment/parsing result and never asked
 * again -- even once the real result landed. Detected by shape (message
 * present, none of the real fields are) rather than by matching the exact
 * wording, so a minor message-copy change upstream does not silently start
 * being read as "found" again.
 */
function isNotFoundSentinel(record: RunResultRecord, key: string): boolean {
  return (
    typeof record.message === "string" &&
    !(key in record) &&
    record.app_id === undefined &&
    record.run_id === undefined &&
    record.workspace_id === undefined &&
    record.payload === undefined &&
    record.data === undefined
  );
}

export function normalizeRunResult(
  payload: unknown,
  agent: keyof typeof RESULT_KEYS
): NormalizedRunResult | null {
  const record = (Array.isArray(payload) ? payload[0] : payload) as
    | RunResultRecord
    | undefined
    | null;

  if (!record || typeof record !== "object") return null;

  const key = RESULT_KEYS[agent];

  if (isNotFoundSentinel(record, key)) return null;

  const inner = (record[key] ?? record.payload ?? record.data ?? record) as Record<string, unknown> | undefined;

  return {
    ...record,
    workbook_id: (record.app_id ?? record.workbook_id) as string | undefined,
    payload: inner,
    // Only surfaced when the agent actually reports one -- parsing does not.
    // Callers fall back to the presence of `payload`, so inventing a status
    // here would mark an in-flight stage complete.
    status: (inner?.status as string | undefined) ?? (record.status as string | undefined) ?? "completed",
  };
}

// ─── Records query builders ─────────────────────────────────────────────────
//
// These return a path + query string with NO base URL, so a route handler can
// hand the result straight to httpClient (which prepends the base for the given
// apiType). Every value is encoded: Qlik space ids are opaque and app names can
// reach these paths via ids that are not URL-safe by construction.

const runQuery = ({ workspaceId, runId }: RunScope) =>
  `workspace_id=${encodeURIComponent(workspaceId)}&run_id=${encodeURIComponent(runId)}`;

/** Per-agent result paths: `/{agent}/{app_id}?workspace_id=&run_id=`. */
export type ResultPath =
  | typeof RECORDS_PATHS.ASSESSMENT
  | typeof RECORDS_PATHS.PARSING
  | typeof RECORDS_PATHS.MAPPING
  | typeof RECORDS_PATHS.REPORT_GENERATION
  | typeof RECORDS_PATHS.VALIDATION;

/** `/assessment/{app_id}?workspace_id=&run_id=` and the per-agent equivalents. */
export const resultPath = (path: ResultPath, scope: RunScope) =>
  `${path}/${encodeURIComponent(scope.appId)}?${runQuery(scope)}`;

/** `/agent-actions?run_id=&workspace_id=&app_id=&agent_name=` (and /agent-logs). */
export const agentPath = (
  path: typeof RECORDS_PATHS.AGENT_ACTIONS | typeof RECORDS_PATHS.AGENT_LOGS,
  scope: RunScope,
  agentName: AgentName
) =>
  `${path}?${runQuery(scope)}&app_id=${encodeURIComponent(scope.appId)}` +
  `&agent_name=${encodeURIComponent(agentName)}`;
