"use client"

import { useMemo } from "react"
import { useSharedTick } from "@/lib/useSharedTick"

interface ElapsedTimerProps {
  startTime: string
  status: string
  /** Pre-computed duration string to show once no longer in progress, if available. */
  durationStr?: string
}

/**
 * Simple elapsed-time ticker: counts up from startTime once per second while
 * status === "in_progress", otherwise shows durationStr (if provided) or the
 * final calculated elapsed time.
 */
export function ElapsedTimer({ startTime, status, durationStr }: ElapsedTimerProps) {
  const isInProgress = status === "in_progress"
  const tick = useSharedTick(isInProgress)
  const now = tick || Date.now()

  const elapsed = useMemo(() => {
    if (!isInProgress && durationStr) {
      return durationStr
    }
    const diff = now - new Date(startTime).getTime()
    if (diff < 0) return "0s"
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }, [isInProgress, durationStr, now, startTime])

  return <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>{elapsed}</span>
}
