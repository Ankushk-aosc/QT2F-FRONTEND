"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { EM_DASH } from "@/lib/display"

interface MetricCardProps {
  label: string
  value: number | string
  icon?: React.ReactNode
  /** Optional semantic tint for the icon tile — purely presentational. */
  tone?: "default" | "info" | "success" | "danger"
  /**
   * Sub-line under the number: a real trend, a rate, or a note about why the
   * value is absent. The slot is always reserved so cards in a row keep the
   * same height whether or not they have one.
   */
  hint?: string
}

const TONE_COLORS: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "var(--primary)",
  info: "var(--info)",
  success: "var(--success)",
  danger: "var(--danger)",
}

/** One number, one label. Used across the Migration Overview and Run History rows. */
export function MetricCard({ label, value, icon, tone = "default", hint }: MetricCardProps) {
  const absent = value === EM_DASH

  return (
    <Card className="dashboard-metric-card">
      <div className="dashboard-metric-card-head">
        <span className="dashboard-metric-card-label">{label}</span>
        {icon && (
          <span
            className="dashboard-metric-card-icon"
            style={{
              color: TONE_COLORS[tone],
              backgroundColor: `color-mix(in srgb, ${TONE_COLORS[tone]} 14%, transparent)`,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <span
        className={absent ? "dashboard-metric-card-value dashboard-metric-card-value-absent" : "dashboard-metric-card-value"}
      >
        {value}
      </span>
      <span className="dashboard-metric-card-hint">{hint ?? " "}</span>
    </Card>
  )
}
