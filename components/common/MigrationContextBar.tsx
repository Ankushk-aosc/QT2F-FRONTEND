"use client"

import React from "react"
import { Bot, Database, Globe, PlayCircle } from "lucide-react"

import { useDashboardStore } from "@/stores/dashboard.store"
import { useUIStore } from "@/stores/ui.store"
import { EM_DASH, orDash } from "@/lib/display"

const WORKSPACE_LABELS: Record<string, string> = {
  qlik: "Qlik Sense",
  tableau: "Tableau",
}

/**
 * The context strip pinned to the bottom of Home and Monitoring.
 *
 * It reads the stores directly rather than taking props, so both pages are
 * guaranteed to show the same four values from the same source — the earlier
 * duplication of this strip is what let them drift apart.
 *
 * Every field falls back to an em dash. In particular there is no environment
 * URL or per-run agent version exposed to the client, so those stay absent
 * rather than being guessed at.
 */
export function MigrationContextBar() {
  const runId = useDashboardStore((s) => s.runId)
  const applications = useDashboardStore((s) => s.applications)
  const activeRunStats = useDashboardStore((s) => s.activeRunStats)
  const workspace = useUIStore((s) => s.workspace)

  // The workbook an agent is currently working on, if any is running.
  const current = applications.find((app) => app.status?.toLowerCase() === "running")

  const resourceCount = activeRunStats?.total_workbooks
  const items = [
    {
      icon: <Database size={18} />,
      label: "Current Resource",
      value: orDash(current?.workbookName),
      meta:
        typeof resourceCount === "number" && Number.isFinite(resourceCount)
          ? `${resourceCount} resource${resourceCount === 1 ? "" : "s"}`
          : undefined,
    },
    {
      icon: <Globe size={18} />,
      label: "Environment",
      value: orDash(WORKSPACE_LABELS[workspace] ?? workspace),
      meta: undefined,
    },
    {
      icon: <Bot size={18} />,
      label: "Current Agent",
      value: orDash(current?.currentAgent),
      meta: undefined,
    },
    {
      icon: <PlayCircle size={18} />,
      label: "Active Run ID",
      value: orDash(runId),
      meta: undefined,
    },
  ]

  return (
    <div className="context-bar">
      {items.map((item) => (
        <div key={item.label} className="context-bar-item">
          <span className="context-bar-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="context-bar-text">
            <span className="context-bar-label">{item.label}</span>
            <span
              className={
                item.value === EM_DASH ? "context-bar-value context-bar-value-absent" : "context-bar-value"
              }
            >
              {item.value}
            </span>
            {item.meta && <span className="context-bar-meta">{item.meta}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
