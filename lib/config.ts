import { useUIStore } from "@/stores/ui.store";
import { MIGRATION_MODE } from "./constants";

export function isLiteMode(): boolean {
  const modeVal = typeof window === "undefined"
    ? (process.env.AGENTVARIABLE ? process.env.AGENTVARIABLE.trim() : "")
    : (useUIStore.getState().migrationMode ? useUIStore.getState().migrationMode.trim() : "");

  return modeVal === MIGRATION_MODE.LITE;
}

/**
 * Whether a run finishes after Parsing rather than running the whole pipeline.
 *
 * This predicate is the single place the partial-vs-full decision is made --
 * every stage-gating branch in the app (agent.store's polling loop, the
 * ResultTab progress bar, MonitoringTab's log tabs, and others; see
 * PROCESSING_MODE.md for the full list) reads only this, nothing else.
 *
 * Backed by ENABLE_FULL_PROCESSING, NOT isLiteMode()/AGENTVARIABLE, and the
 * distinction matters:
 *
 *   - isLiteMode() defaults to "off" (Standard/full) when unset -- correct
 *     for T2F, where the full pipeline is what already works and Lite is the
 *     deliberate opt-OUT.
 *   - Here it is the other way around: Mapping onward is still being built,
 *     so the safe default has to be "off" (stay partial). Aliasing this to
 *     isLiteMode() directly would flip every deployment that has never set
 *     AGENTVARIABLE -- including the client's -- to attempt the full
 *     pipeline the moment this file changed, against a backend that cannot
 *     do Mapping yet. ENABLE_FULL_PROCESSING is a separate, purpose-built
 *     variable specifically so its absence is safe everywhere by default,
 *     and only a deployment explicitly told to enable it does anything
 *     different from today.
 *
 * This is a deliberately temporary arrangement. Once every deployment
 * (client included) is ready for the full pipeline, retire
 * ENABLE_FULL_PROCESSING and this function entirely, and gate stages
 * directly on `isLiteMode()` the way T2F does -- see PROCESSING_MODE.md for
 * the planned end state and the cutover checklist.
 */
export function isPartialProcessing(): boolean {
  const enabledVal = typeof window === "undefined"
    ? (process.env.ENABLE_FULL_PROCESSING ? process.env.ENABLE_FULL_PROCESSING.trim() : "")
    : (useUIStore.getState().fullProcessingEnabled ? "1" : "");

  return enabledVal !== "1";
}
