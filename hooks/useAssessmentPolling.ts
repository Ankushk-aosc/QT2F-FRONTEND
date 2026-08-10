// hooks/useAssessmentPolling.ts
import { useEffect, useRef, useState, useCallback } from "react"
import { assessmentService } from "@/services/assessment.service"

type RunStatus = Awaited<ReturnType<typeof assessmentService.getRunStatus>>

const TERMINAL_STATUSES = ["completed", "failed", "cancelled", "success"] as const

function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

interface UseAssessmentPollingOptions {
  runId: string | null
  enabled?: boolean
  pollingInterval?: number
  onStatusChange?: (status: RunStatus) => void
  onComplete?: (status: RunStatus) => void
  onError?: (error: Error) => void
}

export function useAssessmentPolling({
  runId,
  enabled = true,
  pollingInterval = 10000,
  onStatusChange,
  onComplete,
  onError,
}: UseAssessmentPollingOptions) {
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)
  const attemptRef = useRef(0)

  // ── Cleanup helper ──
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
  }, [])

  // ── Cleanup on unmount ──
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  // ── Core fetch with 404 backoff ──
  const fetchStatus = useCallback(async () => {
    if (!runId || !isMountedRef.current) return

    const maxInitialAttempts = 5

    while (attemptRef.current < maxInitialAttempts) {
      try {
        console.log(`[Polling] Fetching status for: ${runId}`)

        const newStatus = await assessmentService.getRunStatus(runId)

        if (!isMountedRef.current) return

        // Reset attempt counter on success
        attemptRef.current = 0
        setStatus(newStatus)
        setError(null)

        onStatusChange?.(newStatus)

        if (isTerminal(newStatus.status)) {
          console.log(`[Polling] Complete: ${newStatus.status}`)
          stopPolling()
          onComplete?.(newStatus)
        }

        return // success — exit retry loop
      } catch (err: any) {
        if (err?.message?.includes("404")) {
          // 404 → backend not ready yet, retry with exponential backoff
          attemptRef.current++
          const delay = Math.min(5000 * Math.pow(2, attemptRef.current), 60000)
          console.log(`[Polling] 404 for ${runId} — retry #${attemptRef.current} in ${delay}ms`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        } else {
          // Non-404 → real error, stop polling
          console.error("[Polling] Error:", err)

          if (!isMountedRef.current) return

          const error = err instanceof Error ? err : new Error("Unknown polling error")
          setError(error)
          onError?.(error)
          stopPolling()
          return
        }
      }
    }

    // Exhausted all retry attempts
    if (isMountedRef.current) {
      const maxRetriesError = new Error(`Max retries (${maxInitialAttempts}) reached for run ${runId}`)
      setError(maxRetriesError)
      onError?.(maxRetriesError)
      stopPolling()
    }
  }, [runId, onStatusChange, onComplete, onError, stopPolling])

  // ── Start / stop polling based on inputs ──
  useEffect(() => {
    if (!enabled || !runId) {
      stopPolling()
      return
    }

    // Don't restart polling if already in a terminal state
    if (status && isTerminal(status.status)) {
      stopPolling()
      return
    }

    console.log(`[Polling] Starting for: ${runId}`)
    attemptRef.current = 0
    setIsPolling(true)

    // Immediate first fetch + interval
    fetchStatus()
    pollingIntervalRef.current = setInterval(fetchStatus, pollingInterval)

    return () => {
      console.log(`[Polling] Cleanup for: ${runId}`)
      stopPolling()
    }
  }, [runId, enabled, pollingInterval, fetchStatus, stopPolling]) // intentionally omitting `status`

  return {
    status,
    isPolling,
    error,
    isActive: status
      ? status.status === "pending" || status.status === "processing"
      : false,
    isComplete: status ? isTerminal(status.status) : false,
    progress: status?.progress_percentage || 0,
  }
}