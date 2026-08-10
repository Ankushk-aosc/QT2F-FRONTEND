// // hooks/useAssessment.ts
// // Hook for polling assessment status/results with retry and caching logic.
// // Implements robust polling for long-running backend jobs.

// import { useState, useEffect, useRef, useCallback } from "react"
// import { assessmentService, type AssessmentResult, type RunStatus } from "@/services/assessment.service"
// import { withRetry } from "@/lib/api/retry"

// interface UseAssessmentOptions {
//     runId: string | null
//     projectId?: string | null
//     workbookId?: string | null
//     enabled?: boolean
//     pollingInterval?: number
//     maxRetries?: number
// }

// interface UseAssessmentReturn {
//     data: AssessmentResult | null
//     runStatus: RunStatus | null
//     // isLoading: TRUE on initial fetch, FALSE on subsequent polls
//     isLoading: boolean
//     // isPolling: TRUE while actively polling
//     isPolling: boolean
//     error: Error | null
//     progress: number
//     refetch: () => Promise<void>
// }

// export function useAssessment({
//     runId,
//     projectId,
//     workbookId,
//     enabled = true,
//     pollingInterval = 5000,
//     maxRetries = 3,
// }: UseAssessmentOptions): UseAssessmentReturn {
//     const [data, setData] = useState<AssessmentResult | null>(null)
//     const [runStatus, setRunStatus] = useState<RunStatus | null>(null)

//     // isLoading is true only during the INITIAL fetch to show a spinner.
//     // Subsequent updates happen in background without spinner blocking UI.
//     const [isLoading, setIsLoading] = useState(false)
//     const [isPolling, setIsPolling] = useState(false)
//     const [error, setError] = useState<Error | null>(null)

//     const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
//     const isMountedRef = useRef(true)
//     const abortControllerRef = useRef<AbortController | null>(null)

//     // Cleanup on unmount
//     useEffect(() => {
//         isMountedRef.current = true
//         return () => {
//             isMountedRef.current = false
//             if (pollingTimeoutRef.current) {
//                 clearTimeout(pollingTimeoutRef.current)
//                 pollingTimeoutRef.current = null
//             }
//             if (abortControllerRef.current) {
//                 abortControllerRef.current.abort()
//             }
//         }
//     }, [])

//     const fetchData = useCallback(async (isInitial = false) => {
//         if (!runId || !isMountedRef.current) return

//         if (isInitial) setIsLoading(true)

//         // Clear previous timeout to prevent overlaps
//         if (pollingTimeoutRef.current) {
//             clearTimeout(pollingTimeoutRef.current)
//             pollingTimeoutRef.current = null
//         }

//         try {
//             // If we have specific coordinates, fetch specific workbook result
//             if (projectId && workbookId) {
//                 const result = await withRetry(
//                     () => assessmentService.getWorkbookResult(projectId, workbookId, runId),
//                     { retries: maxRetries, shouldRetry: (err) => true }
//                 )

//                 if (isMountedRef.current) {
//                     setData(result)
//                     setError(null)

//                     // Stop polling if completed/failed/cancelled
//                     if (result && (result.status === "completed" || result.status === "failed")) {
//                         setIsPolling(false)
//                         // Do not schedule next poll
//                         return
//                     }
//                 }
//             }
//             // Otherwise fetch generic run status
//             else {
//                 const status = await withRetry(
//                     () => assessmentService.getRunStatus(runId),
//                     { retries: maxRetries }
//                 )

//                 if (isMountedRef.current) {
//                     setRunStatus(status)
//                     setError(null)

//                     if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
//                         setIsPolling(false)
//                         return
//                     }
//                 }
//             }

//             // Schedule next poll if still enabled
//             if (enabled && isMountedRef.current) {
//                 pollingTimeoutRef.current = setTimeout(() => fetchData(false), pollingInterval)
//             }

//         } catch (err) {
//             if (isMountedRef.current) {
//                 console.error("[useAssessment] Polling error:", err)
//                 // Only set error on initial load or critical failure? 
//                 // We set error but maybe don't stop polling if transient.
//                 setError(err instanceof Error ? err : new Error("Unknown error"))

//                 // Still retry polling unless max retries logic handled by 'withRetry' threw up
//                 if (enabled) {
//                     pollingTimeoutRef.current = setTimeout(() => fetchData(false), pollingInterval)
//                 }
//             }
//         } finally {
//             if (isInitial && isMountedRef.current) setIsLoading(false)
//         }
//     }, [runId, projectId, workbookId, enabled, pollingInterval, maxRetries])

//     // Initial fetch and start polling
//     useEffect(() => {
//         if (!enabled || !runId) {
//             setIsPolling(false)
//             if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
//             return
//         }

//         setIsPolling(true)
//         fetchData(true)

//         return () => {
//             if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current)
//         }
//     }, [runId, projectId, workbookId, enabled, fetchData])

//     return {
//         data,
//         runStatus,
//         isLoading,
//         isPolling,
//         error,
//         progress: runStatus?.progress_percentage || 0,
//         refetch: () => fetchData(true)
//     }
// }


















// hooks/useAssessment.ts
// Only cares about assessment result — stops immediately when complete

import { useState, useEffect, useRef, useCallback } from "react"
import { assessmentService, type AssessmentResult, type RunStatus } from "@/services/assessment.service"

interface UseAssessmentOptions {
  runId: string | null
  projectId: string
  workbookId: string
  enabled?: boolean
  pollingInterval?: number
}

interface UseAssessmentReturn {
  data: AssessmentResult | null
  isLoading: boolean
  isPolling: boolean
  error: Error | null
  isComplete: boolean
  refetch: () => Promise<void>
}

export function useAssessment({
  runId,
  projectId,
  workbookId,
  enabled = true,
  pollingInterval = 8000, // Slightly longer — assessment doesn't need ultra-fast polling
}: UseAssessmentOptions): UseAssessmentReturn {
  const [data, setData] = useState<AssessmentResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchAssessment = useCallback(async (initial = false) => {
    if (!runId || !projectId || !workbookId || !mountedRef.current) return

    if (initial) setIsLoading(true)

    try {
      const result = await assessmentService.getWorkbookResult(projectId, workbookId, runId)

      if (mountedRef.current) {
        setData(result)
        setError(null)

        // If assessment is complete → stop everything
        if (result?.status === "completed" || result?.status === "failed") {
          setIsPolling(false)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
          return // ← immediate stop
        }
      }
    } catch (err: any) {
      if (err.message?.includes("404") || err.message?.includes("Not Found")) {
        // Still waiting — silent retry, no error shown
      } else if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error("Failed to fetch assessment"))
      }
    } finally {
      if (initial && mountedRef.current) setIsLoading(false)
    }

    // Schedule next poll only if still active
    if (enabled && mountedRef.current) {
      timeoutRef.current = setTimeout(() => fetchAssessment(false), pollingInterval)
    }
  }, [runId, projectId, workbookId, enabled, pollingInterval])

  useEffect(() => {
    if (!enabled || !runId || !projectId || !workbookId) {
      setIsPolling(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      return
    }

    setIsPolling(true)
    fetchAssessment(true)

    return () => {
      mountedRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [runId, projectId, workbookId, enabled, fetchAssessment])

  return {
    data,
    isLoading,
    isPolling,
    error,
    isComplete: !!data && (data.status === "completed" || data.status === "failed"),
    refetch: () => fetchAssessment(true)
  }
}