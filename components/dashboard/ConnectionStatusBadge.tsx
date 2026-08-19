"use client"

import React from "react"
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

import type { ConnectionStatus } from "@/types/connectors"

/**
 * The single way connection state is shown anywhere in the application.
 *
 * Every state carries a word as well as a glyph and a colour. Colour alone
 * fails for the ~8% of men with a colour vision deficiency, and "green dot
 * versus red dot" is exactly the distinction someone would need to act on here.
 * The icon is `aria-hidden` because the text already says it.
 */

export type DisplayStatus = ConnectionStatus | "testing"

const COLOR: Record<string, string> = {
  connected: "var(--success)",
  error: "var(--danger)",
  disconnected: "var(--text-muted)",
  "not-configured": "var(--warning)",
}

export interface ConnectionStatusBadgeProps {
  status: DisplayStatus
  /** Overrides the default wording, e.g. to name the connector. */
  label?: string
}

export function ConnectionStatusBadge({ status, label }: ConnectionStatusBadgeProps) {
  if (status === "testing") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", color: "var(--text-muted)" }} role="status">
        <Spinner size="extra-small" />
        <span style={{ fontSize: "var(--text-sm)" }}>{label ?? "Testing…"}</span>
      </span>
    )
  }

  const presentation = {
    connected: { icon: <CheckCircle2 size={16} aria-hidden />, text: "Connected" },
    error: { icon: <XCircle size={16} aria-hidden />, text: "Connection failed" },
    disconnected: { icon: <AlertTriangle size={16} aria-hidden />, text: "Disconnected" },
    "not-configured": { icon: <AlertTriangle size={16} aria-hidden />, text: "Configuration required" },
  }[status]

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap", color: COLOR[status] }}>
      {presentation.icon}
      <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{label ?? presentation.text}</span>
    </span>
  )
}
