"use client"

import React from "react"
import { Check, Circle, AlertTriangle, PlugZap, AlertCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import type { ConnectionStatus, ConnectorConnection, HealthState } from "@/types/connectors"

/**
 * Status and health indicators shared by the connector card and its detail
 * panel.
 *
 * Status and health are shown separately because they answer different
 * questions, and collapsing them would hide the interesting case. Status is
 * what the administrator intended — configured, connected, deliberately
 * disconnected. Health is what the last probe actually found. A connector that
 * is `connected` but `degraded` is precisely the state worth surfacing: it
 * authenticates, so nothing looks broken, but discovery is failing and the
 * metadata behind every migration picker is going stale.
 */

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const STATUS_APPEARANCE: Record<
  ConnectionStatus,
  { label: string; variant: "success" | "destructive" | "secondary"; icon: React.ReactElement }
> = {
  connected: { label: "Connected", variant: "success", icon: <Check size={12} /> },
  disconnected: { label: "Disconnected", variant: "secondary", icon: <PlugZap size={12} /> },
  error: { label: "Error", variant: "destructive", icon: <AlertCircle size={12} /> },
  "not-configured": { label: "Not configured", variant: "secondary", icon: <Circle size={12} /> },
}

export function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const appearance = STATUS_APPEARANCE[status]
  return (
    <Badge variant={appearance.variant} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {appearance.icon}
      {appearance.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

const HEALTH_APPEARANCE: Record<
  HealthState,
  { label: string; variant: "success" | "destructive" | "warning" | "secondary"; icon: React.ReactElement }
> = {
  healthy: { label: "Healthy", variant: "success", icon: <Check size={12} /> },
  degraded: { label: "Degraded", variant: "warning", icon: <AlertTriangle size={12} /> },
  unhealthy: { label: "Unhealthy", variant: "destructive", icon: <AlertCircle size={12} /> },
  unknown: { label: "Not tested", variant: "secondary", icon: <Circle size={12} /> },
}

export interface HealthBadgeProps {
  health: HealthState
  /** Reason from the last probe, shown in a tooltip when present. */
  message?: string
}

export function HealthBadge({ health, message }: HealthBadgeProps) {
  const appearance = HEALTH_APPEARANCE[health]

  const badge = (
    <Badge variant="outline" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      {appearance.icon}
      {appearance.label}
    </Badge>
  )

  // Only wrap in a tooltip when there is something to say — an empty tooltip
  // that opens on hover is worse than none.
  if (!message) return badge

  return <Tooltip content={message}>{badge}</Tooltip>
}

// ---------------------------------------------------------------------------
// Cache freshness
// ---------------------------------------------------------------------------

/** Rounded, human-scale age. Exact timestamps belong in the detail panel. */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never"

  const elapsed = Date.now() - Date.parse(iso)
  if (!Number.isFinite(elapsed) || elapsed < 0) return "just now"

  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months === 1 ? "" : "s"} ago`
}

/**
 * Last-synchronisation line.
 *
 * "Never" is stated plainly rather than hidden: a connected connector that has
 * never synced has no metadata for the migration wizard, and that is worth
 * seeing on the card.
 */
export function LastSyncLabel({ connection }: { connection: ConnectorConnection | null }) {
  const value = connection?.lastSyncAt ?? null

  return (
    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
      Last sync: {value ? formatRelativeTime(value) : "never"}
    </span>
  )
}

export function StatusRow({ connection }: { connection: ConnectorConnection | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
      <ConnectionStatusBadge status={connection?.status ?? "not-configured"} />
      <HealthBadge health={connection?.health ?? "unknown"} message={connection?.healthMessage || undefined} />
    </div>
  )
}
