"use client"

import React from "react"

import { useUIStore } from "@/stores/ui.store"
import type { ConnectorLogEntry, ConnectorLogLevel } from "@/types/connectors"
import { Badge } from "@/components/ui/badge"

import { EmptyState } from "./ConnectorFeedback"

/**
 * Activity log for one connector.
 *
 * Exists so that "why is this connector degraded" is answerable from the
 * Administration Center rather than from application logs an administrator has
 * no access to. Every save, test, sync and disconnect writes an entry
 * server-side, including the failure message from the platform itself.
 *
 * Timestamps honour the platform timezone setting rather than the browser's, so
 * an entry here lines up with the same event in run history.
 */

const LEVEL_VARIANT: Record<ConnectorLogLevel, "success" | "warning" | "destructive"> = {
  info: "success",
  warn: "warning",
  error: "destructive",
}

export interface ConnectionLogsProps {
  logs: readonly ConnectorLogEntry[]
}

export function ConnectionLogs({ logs }: ConnectionLogsProps) {
  const timezone = useUIStore((state) => state.timezone)

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Saving, testing, syncing or disconnecting this connector will be recorded here, including any message returned by the platform."
      />
    )
  }

  const format = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone || "UTC",
      }).format(new Date(iso))
    } catch {
      // A stored timezone the runtime does not recognise must not break the
      // panel — fall back to the raw value rather than throwing.
      return iso
    }
  }

  return (
    <div className="connector-logs-list">
      {logs.map((entry) => (
        <div key={entry.id} className="connector-logs-entry">
          <span className="connector-logs-timestamp">{format(entry.at)}</span>
          <Badge variant={LEVEL_VARIANT[entry.level]} style={{ flexShrink: 0 }}>
            {entry.event}
          </Badge>
          <span className="connector-logs-message">{entry.message}</span>
        </div>
      ))}
    </div>
  )
}
