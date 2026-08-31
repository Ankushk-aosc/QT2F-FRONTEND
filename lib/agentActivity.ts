/**
 * Normalizer for the records API's agent-actions feed.
 *
 * WHY THIS EXISTS
 *
 * `GET {RECORDS_BASE}/agent-actions` returns records shaped like this (verified
 * against the deployed dev API, run c855fe22, 67 records):
 *
 *   {
 *     "id": "1e8e030f-...",
 *     "run_id": "c855fe22-...",
 *     "workspace_id": "personal",
 *     "app_id": "391635af-...",
 *     "timestamp": "2026-08-14T09:16:53.409732",
 *     "agent_name": "Assessment",
 *     "action": "Extracted 10 assessment dimensions.",
 *     "details": "Processing 391635af-...",
 *     "correlation_id": "391635af-..."
 *   }
 *
 * `stores/agent.store.ts` declares its `Activity` with the Tableau-era field
 * names -- `activity_summary`, `created_at`, `status`, `workbook_id` -- none of
 * which this payload has. The damage was silent and total:
 *
 *   - AgentStageBlock mapped `action: a.activity_summary || a.type || ""`, so
 *     every activity became the empty string and its own
 *     `.filter(a => a.action)` then dropped ALL of them. The sidebar's per-agent
 *     blocks could never render a single line, whatever the backend returned.
 *   - The store sorted on `new Date(a.created_at)` -> NaN for every record, so
 *     the comparator was meaningless and step order was whatever the API
 *     happened to return.
 *
 * Normalizing once, at the API-route boundary, fixes both without asking each
 * reader to know the history. The output is a SUPERSET: the real field names
 * and the legacy aliases are both populated, so nothing downstream breaks while
 * new code can read the honest names.
 *
 * @see app/api/activities/route.ts -- the single place this is applied.
 */

/**
 * A record with both the live field names and the legacy aliases the older
 * stores still read.
 */
export interface NormalizedAgentAction {
  id: string;
  run_id: string;
  workspace_id: string;
  app_id: string;
  agent_name: string;
  /** Human-readable step summary. Never empty -- see `summarize` below. */
  action: string;
  /** Secondary context. "" when upstream had nothing beyond the action. */
  details: string;
  correlation_id: string;
  /** ISO timestamp of the step. */
  timestamp: string;

  // ── Legacy aliases. Same values, Tableau-era spellings. ──
  /** = timestamp */
  created_at: string;
  /** = action */
  activity_summary: string;
  /** = app_id */
  workbook_id: string;
  /** = workspace_id */
  project_id: string;
  /**
   * Upstream sends no status on these records, so this is "" unless a record
   * carries one. Deliberately NOT synthesised: agent.store treats a terminal
   * status as "this stage is finished, stop polling", and inventing one would
   * end polling on the first step rather than the last.
   */
  status: string;
  type: string;
  project_name: string;
  payload: unknown;
}

/**
 * Bare log levels that appear in `action` on Orchestrator records, where the
 * real message is in `details` instead ("INFO" + "Assessment starting for ...").
 * Treating these as the summary would print a column of "INFO".
 */
const BARE_LOG_LEVELS = new Set([
  "info",
  "debug",
  "warn",
  "warning",
  "error",
  "trace",
  "log",
]);

/** The backend's "nothing recorded" sentinel, which must not surface as a step. */
const isNoActionsSentinel = (text: string): boolean =>
  text.toLowerCase().includes("no actions found");

const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value);

/**
 * Picks the line to show for a record.
 *
 * `action` normally holds it. When `action` is only a log level the message is
 * in `details`, so they swap -- otherwise Orchestrator's phase transitions
 * ("Parsing starting for ...", genuinely useful) would all read "INFO".
 */
function summarize(action: string, details: string): { action: string; details: string } {
  if (action && !BARE_LOG_LEVELS.has(action.toLowerCase())) {
    return { action, details };
  }
  if (details) {
    // The level itself is kept as the detail so severity is not simply lost.
    return { action: details, details: action };
  }
  return { action, details };
}

/**
 * Detail text that repeats what the reader already knows is noise, not detail.
 *
 * Assessment and Parsing stamp every record with "Processing <app_id>", and the
 * block is already rendered under that app's card. Printing it against all 40
 * steps would bury the one line in five that says something.
 */
export function isRedundantDetail(details: string, action: string, appId?: string): boolean {
  const value = details.trim();
  if (!value) return true;
  if (value === action.trim()) return true;
  if (/^processing\s+\S+$/i.test(value)) return true;
  if (appId && value.includes(appId)) return true;
  return false;
}

/** True when `record` is a usable agent-action object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normalizes one raw record. Returns null for anything unusable -- a non-object,
 * or a record whose summary would be empty, which would render as a blank row.
 */
export function normalizeAgentAction(raw: unknown): NormalizedAgentAction | null {
  if (!isRecord(raw)) return null;

  // Each field accepts the live name first, then the aliases the API has used
  // across generations, so this keeps working if a record predates the rename.
  const rawAction = str(raw.action ?? raw.activity_summary ?? raw.message ?? raw.type);
  const rawDetails = str(raw.details ?? raw.detail ?? raw.description);
  const { action, details } = summarize(rawAction, rawDetails);

  if (!action || isNoActionsSentinel(action)) return null;

  const timestamp = str(raw.timestamp ?? raw.created_at ?? raw.createdAt) || new Date().toISOString();
  const appId = str(raw.app_id ?? raw.workbook_id);
  const workspaceId = str(raw.workspace_id ?? raw.project_id);
  const agentName = str(raw.agent_name ?? raw.agent);

  return {
    // A stable id matters: AgentActionsBlock keys its "already typed" set on it,
    // so a synthesised-per-render id would re-type every line on every poll.
    id: str(raw.id) || `${agentName}-${timestamp}-${action}`,
    run_id: str(raw.run_id),
    workspace_id: workspaceId,
    app_id: appId,
    agent_name: agentName,
    action,
    details,
    correlation_id: str(raw.correlation_id) || appId,
    timestamp,

    created_at: timestamp,
    activity_summary: action,
    workbook_id: appId,
    project_id: workspaceId,
    status: str(raw.status),
    type: str(raw.type),
    project_name: str(raw.project_name),
    payload: raw.payload ?? null,
  };
}

/**
 * Normalizes a whole response, oldest step first.
 *
 * Sorting here rather than in each caller is deliberate: the store's own sort
 * was comparing `NaN`s (see the header note) and the order the API returns is
 * not guaranteed, so this is the one place that can promise chronological
 * order to every reader.
 */
export function normalizeAgentActions(data: unknown): NormalizedAgentAction[] {
  const list = Array.isArray(data)
    ? data
    : isRecord(data)
      ? // A stage that ran but wrote no individual records answers with a bare
        // { message } object; treat it as a single step.
        [data]
      : [];

  return list
    .map(normalizeAgentAction)
    .filter((item): item is NormalizedAgentAction => item !== null)
    .sort((a, b) => {
      const left = new Date(a.timestamp).getTime();
      const right = new Date(b.timestamp).getTime();
      // Unparseable timestamps keep their relative order instead of shuffling
      // the list, which is what a NaN comparator does.
      if (Number.isNaN(left) || Number.isNaN(right)) return 0;
      return left - right;
    });
}
