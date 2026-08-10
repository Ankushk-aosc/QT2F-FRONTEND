import { useUIStore } from "@/stores/ui.store";
import { MIGRATION_MODE } from "./constants";

export function isLiteMode(): boolean {
  const modeVal = typeof window === "undefined"
    ? (process.env.AGENTVARIABLE ? process.env.AGENTVARIABLE.trim() : "")
    : (useUIStore.getState().migrationMode ? useUIStore.getState().migrationMode.trim() : "");

  return modeVal === MIGRATION_MODE.LITE;
}
