"use client"

import React from "react"

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
}

/** The "nothing here yet" branch of an API-backed view — not a blank space. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "32px 16px", minHeight: "120px", textAlign: "center", color: "var(--text-muted)" }}>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>{title}</span>
      {description && <span style={{ fontSize: "var(--text-sm)" }}>{description}</span>}
      {action}
    </div>
  )
}
