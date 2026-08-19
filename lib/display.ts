/**
 * Display helpers for values that may genuinely not exist.
 *
 * Several fields the UI shows are not supplied by the current backend (a run's
 * source platform, its duration, per-run resource counts, and so on). Rather
 * than substituting zeros — which would read as "none" when the truth is "not
 * reported" — those render as an em dash. `orDash` is the single place that
 * decides what "absent" looks like.
 */

export const EM_DASH = "—"

/** A value, or an em dash when it is null/undefined/blank. Zero is a real value and is kept. */
export function orDash(value: unknown): string {
  if (value === null || value === undefined) return EM_DASH
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed === "" ? EM_DASH : trimmed
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : EM_DASH
  }
  return String(value)
}

/** A timestamp as "18 May 2024, 10:24 AM", or an em dash when unparseable. */
export function formatDateTime(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return EM_DASH
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return EM_DASH
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Seconds as "24m 15s" / "1h 02m", or an em dash when not a usable number. */
export function formatDuration(seconds: unknown): string {
  const total = typeof seconds === "number" ? seconds : Number(seconds)
  if (!Number.isFinite(total) || total < 0) return EM_DASH
  const whole = Math.floor(total)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, "0")}s`
  return `${secs}s`
}
