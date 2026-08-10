/**
 * useTimestamp — Centralized timezone-aware timestamp formatting hook.
 *
 * Reads the user's timezone preference from the global UIStore and exposes
 * a `format()` function that applies it to any UTC ISO timestamp.
 *
 * Duration calculations (elapsed ms) are intentionally excluded — those
 * remain UTC-relative via Date.now() and are unaffected by timezone.
 */
"use client"

import { useUIStore } from "@/stores/ui.store"
import { formatDBTimestamp } from "@/lib/utils"

export function useTimestamp() {
    const timezone = useUIStore((s) => s.timezone)

    /**
     * Format a UTC ISO timestamp string or epoch milliseconds into a
     * human-readable string using the user's stored timezone preference.
     *
     * @param ts       - UTC ISO string or epoch ms number
     * @param multiLine - If true, separates date and time with a newline
     * @returns        - Formatted string, e.g. "2026-05-18 19:42:11 (Asia/Kolkata)"
     */
    const format = (ts?: string | number, multiLine = false): string => {
        return formatDBTimestamp(ts, multiLine, timezone)
    }

    return { format, timezone }
}
