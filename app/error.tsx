"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

import { HOME_ROUTE } from "@/lib/navigation"

/**
 * Next's root error boundary — catches what escapes a page's own render, so a
 * single broken component doesn't take the whole app down without a recovery
 * option. `ErrorBoundary` (used inside the migration workspace) handles the
 * same job for individual tabs; this is the outermost net.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled application error:", error)
  }, [error])

  return (
    <div className="error-page">
      <span style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Something went wrong.</span>
      <span className="error-page-description">
        {error.message || "An unexpected error occurred."}
      </span>
      <div className="error-page-actions">
        <Button onClick={reset}>Try Again</Button>
        <Button as="a" href={HOME_ROUTE} variant="secondary">
          Go Home
        </Button>
      </div>
    </div>
  )
}
