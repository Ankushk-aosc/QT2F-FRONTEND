"use client"

import { useEffect, useState, useMemo } from "react"
import { formatDuration, parseDBTimestamp } from "@/lib/utils"

interface DurationTimerProps {
  startTime: any
  status: string
  activities?: any[]
  endTime?: any
  totalDuration?: number
  className?: string
  style?: React.CSSProperties
  /** If true, shows a loading spinner regardless of current duration value */
  isLoading?: boolean
  runId?: string
  workbookId?: string
}

/**
 * A reactive timer component that shows duration.
 * For running processes, it ticks every second.
 * For completed processes, it shows the final duration based on end_time or last activity.
 */
export function DurationTimer({ 
  startTime, 
  status, 
  activities = [], 
  endTime, 
  totalDuration,
  className,
  style,
  isLoading = false,
  runId,
  workbookId
}: DurationTimerProps) {
  const [now, setNow] = useState(Date.now())
  const isFinal = ["completed", "failed", "success", "error", "paused", "parsing", "pending", "unknown", "done", "stopped", "cancelled", "halted"].some(s => status.toLowerCase().includes(s))
  
  // If we are in a final state (like Validation Pending) but the API hasn't synced the duration yet,
  // we want to continue showing the loader until the duration arrives.
  const isWaitingForApiDuration = isFinal && !totalDuration && status.toLowerCase().includes("pending");

  const [savedEndTime, setSavedEndTime] = useState<number | null>(null)

  useEffect(() => {
    if (isFinal) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isFinal])

  useEffect(() => {
    if (typeof window === "undefined") return

    const key = (runId && workbookId) ? `t2f_end_time_${runId}_${workbookId}` : null

    if (isFinal) {
      // If we don't have a backend end time or total duration, we look in localStorage
      if (!endTime && (!totalDuration || totalDuration <= 0) && (!activities || activities.length === 0)) {
        if (key) {
          const stored = localStorage.getItem(key)
          if (stored) {
            setSavedEndTime(Number(stored))
          } else {
            const nowTime = Date.now()
            localStorage.setItem(key, String(nowTime))
            setSavedEndTime(nowTime)
          }
        }
      }
    } else {
      // Clear storage if the state becomes active/non-final again
      if (key) {
        localStorage.removeItem(key)
      }
      setSavedEndTime(null)
    }
  }, [isFinal, endTime, totalDuration, activities, runId, workbookId])

  const durationStr = useMemo(() => {
    const start = startTime ? parseDBTimestamp(startTime).getTime() : 0
    const end = endTime ? parseDBTimestamp(endTime).getTime() : 0

    // 1. If we have totalDuration (comes from backend processed_items), use it
    if (totalDuration !== undefined && totalDuration > 0) {
      // Backend might send seconds or ms. If < 100k, assume seconds.
      return formatDuration(totalDuration * (totalDuration < 100000 ? 1000 : 1))
    }

    // 2. If we have end and end > start, use it
    if (start && end && end > start) {
      return formatDuration(end - start)
    }

    if (!start) return "—"

    // 3. Try to get duration from activities
    if (activities && activities.length > 0) {
      const timestamps = activities
        .map(a => parseDBTimestamp(a.timestamp || a.time || a.created_at || a._raw?.timestamp || a.payload?.timestamp || a.payload?.time).getTime())
        .filter(t => !isNaN(t))
      
      if (timestamps.length > 0) {
        const earliest = Math.min(...timestamps)
        const latest = Math.max(...timestamps)
        
        // Measure purely based on this workbook's own log activities
        // This ensures each workbook shows its own specific duration rather than the overall run's duration
        const durationMs = latest - earliest;
        return formatDuration(Math.max(1000, durationMs))
      }
    }

    if (isFinal) {
      // 4. Fallback to localStorage saved end time if we captured one
      if (savedEndTime && savedEndTime > start) {
        return formatDuration(savedEndTime - start)
      }

      // If it is paused or parsing and we have a start time, show elapsed time as fallback 
      // only if it started recently (within 15 minutes) to avoid huge durations on historical paused runs
      if (status.toLowerCase().includes("paused") || status.toLowerCase().includes("parsing")) {
        const diff = now - start
        if (diff > 0 && diff < 15 * 60 * 1000) {
          return formatDuration(diff)
        }
        return "—"
      }
      
      // Final fallback: If it is marked as completed/success, show 0s instead of "—" 
      // IF we have a start time, to indicate a very fast task.
      const isFinalCompleted = ["completed", "success", "done"].some(s => status.toLowerCase().includes(s))
      if (isFinalCompleted) {
        return "0s"
      }
      return "—" 
    }

    // 5. Running duration
    const diff = now - start
    return diff > 0 ? formatDuration(diff) : "0s"
  }, [startTime, status, activities, isFinal, now, endTime, totalDuration, savedEndTime])
  const showSpinner = isLoading || !isFinal || isWaitingForApiDuration;

  if (showSpinner) {
    return (
      <span 
        className={className}
        style={{ 
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: "var(--text-muted)",
          fontFamily: "monospace",
          ...style
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "11px",
            height: "11px",
            border: "2px solid var(--text-muted)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.85s linear infinite",
            flexShrink: 0
          }}
        />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
        {(!isFinal || isWaitingForApiDuration) ? null : <span>{durationStr}</span>}
      </span>
    )
  }

  return (
    <span 
      className={className}
      style={{
        fontSize: "12px",
        color: "var(--text-muted)",
        fontFamily: "monospace",
        opacity: 0.8,
        ...style
      }}
    >
      {durationStr}
    </span>
  )
}
