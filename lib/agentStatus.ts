import type { ProcessStatus } from "@/types/assessment";

/**
 * Stage/app status vocabulary shared by the left sidebar and the Agent Execution
 * Tracker, so the two surfaces can never disagree about what a run is doing.
 */

export type NormalizedStatus = "pending" | "running" | "completed" | "failed";

/** Folds the various spellings upstream uses into four canonical values. */
export function normalizeStatus(status?: string): NormalizedStatus {
  if (!status) return "pending";
  const value = String(status).toLowerCase();
  if (["running", "in_progress", "inprogress", "processing", "in-progress"].includes(value)) return "running";
  if (["done", "completed", "complete", "success"].includes(value)) return "completed";
  if (["error", "failed", "fail"].includes(value)) return "failed";
  return "pending";
}

export interface StageState {
  status?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * Lite Mode marks parsing, mapping and reportGeneration as `failed` with a
 * "Skipped — Lite Mode (assessment-only)" error (see `app/migration/page.tsx`).
 * Those are deliberate omissions, not failures, and must not render red.
 */
export function isSkippedStage(state: StageState | undefined): boolean {
  if (!state) return false;
  return normalizeStatus(state.status) === "failed" && /^\s*skipped/i.test(String(state.error ?? ""));
}

/** A real failure — i.e. failed and not a Lite Mode skip. */
export function isFailedStage(state: StageState | undefined): boolean {
  if (!state) return false;
  return normalizeStatus(state.status) === "failed" && !isSkippedStage(state);
}

export type AppStatusLabel =
  | "Stopped"
  | "Failed"
  | "Migration Completed"
  | "Extraction Completed"
  | "Processing..."
  | "Pending";

/**
 * App-level badge text. The Tableau app derives this from its datalayer /
 * generation / validation stores (`getDisplayedStatus` in LeftSidebar.tsx); Qlik
 * has no equivalent, so it comes from the four process states instead.
 *
 * "Extraction Completed" is the Tableau app's wording for an assessment-only run,
 * reused here for Lite Mode.
 */
export function deriveAppStatus(states: Partial<Record<keyof ProcessStatus, StageState>>): AppStatusLabel {
  const entries = Object.values(states ?? {}).filter(Boolean) as StageState[];
  if (entries.length === 0) return "Pending";

  if (entries.some(isFailedStage)) return "Failed";
  if (entries.some((state) => normalizeStatus(state.status) === "running")) return "Processing...";

  const settled = entries.every(
    (state) => normalizeStatus(state.status) === "completed" || isSkippedStage(state),
  );
  if (!settled) return "Pending";

  return entries.some(isSkippedStage) ? "Extraction Completed" : "Migration Completed";
}

/** Badge colour for a status label, matching the Tableau app's `getStatusColor`. */
export function statusColor(label: string): "success" | "warning" | "danger" | "subtle" {
  const value = label.toLowerCase();
  if (value === "running" || value.includes("processing")) return "warning";
  if (value === "failed") return "danger";
  if (value.includes("completed") || value === "success") return "success";
  return "subtle";
}
