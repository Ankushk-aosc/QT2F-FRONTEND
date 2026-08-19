"use client"

import React from "react"
import { Card } from "@/components/ui/card"

/**
 * The migration agents this platform actually runs, in pipeline order.
 *
 * Deliberately the real roster from `lib/agentNames.ts` rather than a generic
 * "Data Migration / Metadata / Logging" list: naming agents this system does
 * not have would misrepresent the architecture.
 */
const AGENTS: ReadonlyArray<string> = [
  "Assessment Agent",
  "Parsing Agent",
  "Mapping Agent",
  "Data Layer Agent",
  "Report Generation Agent",
  "Validation Agent",
]

interface AgentStatusCardProps {
  /** Top-right slot, e.g. a "View all" link. */
  action?: React.ReactNode
  title?: string
}

/**
 * Per-agent status.
 *
 * The platform tracks agent *activity per workbook* but exposes no agent
 * health or liveness signal, so each row reports "Status unavailable" instead
 * of asserting "Running". Wiring a real health source means changing only the
 * status cell here.
 */
export function AgentStatusCard({ action, title = "Migration Agents" }: AgentStatusCardProps) {
  return (
    <Card className="agent-status-card">
      <div className="agent-status-head">
        <span className="agent-status-title">{title}</span>
        {action && <div>{action}</div>}
      </div>

      <ul className="agent-status-list">
        {AGENTS.map((name) => (
          <li key={name} className="agent-status-row">
            <span className="agent-status-dot" aria-hidden="true" />
            <span className="agent-status-name">{name}</span>
            <span className="agent-status-value">Status unavailable</span>
          </li>
        ))}
      </ul>

      <span className="agent-status-note">
        This deployment does not report agent health.
      </span>
    </Card>
  )
}
