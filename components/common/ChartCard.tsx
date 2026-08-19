"use client"

import React from "react"
import { Card } from "@/components/ui/card"

interface ChartCardProps {
  title: string
  /** Top-right slot — a range selector, a "View all" link, etc. */
  action?: React.ReactNode
  /** Bottom slot — typically a "View details →" link. */
  footer?: React.ReactNode
  /**
   * When true the chart body is replaced by `emptyMessage`. The card, its title
   * and its height are kept, so a section whose data the backend does not yet
   * supply still occupies its place in the layout instead of vanishing.
   */
  empty?: boolean
  emptyMessage?: string
  /** Keeps cards in a row the same height regardless of content. */
  bodyMinHeight?: number
  children?: React.ReactNode
}

/** A titled card for a chart or a breakdown, with a first-class empty state. */
export function ChartCard({
  title,
  action,
  footer,
  empty = false,
  emptyMessage = "No data available",
  bodyMinHeight = 200,
  children,
}: ChartCardProps) {
  return (
    <Card className="chart-card">
      <div className="chart-card-head">
        <span className="chart-card-title">{title}</span>
        {action && <div className="chart-card-action">{action}</div>}
      </div>

      <div className="chart-card-body" style={{ minHeight: `${bodyMinHeight}px` }}>
        {empty ? <span className="chart-card-empty">{emptyMessage}</span> : children}
      </div>

      {footer && <div className="chart-card-footer">{footer}</div>}
    </Card>
  )
}
