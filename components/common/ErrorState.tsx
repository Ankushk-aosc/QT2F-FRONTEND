"use client"

import React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

/** The failure branch of an API-backed view, with a retry action when one is available. */
export function ErrorState({ title = "Something went wrong.", description, onRetry }: ErrorStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", padding: "32px 16px", minHeight: "120px", textAlign: "center" }}>
      <span style={{ color: "var(--danger)", fontWeight: 600 }}>{title}</span>
      {description && <span style={{ fontSize: "var(--text-sm)" }}>{description}</span>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          Retry
        </Button>
      )}
    </div>
  )
}
