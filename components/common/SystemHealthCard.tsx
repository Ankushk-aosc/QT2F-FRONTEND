"use client"

import React from "react"
import { CircleDashed } from "lucide-react"

/**
 * The sidebar's platform-health summary.
 *
 * This deployment exposes no health or status endpoint, so the card reports
 * exactly that. It deliberately does not claim "All systems operational" —
 * asserting health we cannot observe would be worse than admitting we can't see
 * it. When a real health source exists, this is the single place to wire it.
 */
export function SystemHealthCard() {
  return (
    <div className="system-health-card" role="status">
      <span className="system-health-card-head">
        <CircleDashed size={14} aria-hidden="true" />
        System status unavailable
      </span>
      <span className="system-health-card-body">
        This deployment does not report platform health.
      </span>
    </div>
  )
}
