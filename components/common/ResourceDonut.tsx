"use client"

import React from "react"
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"

export interface ResourceSlice {
  name: string
  value: number
  /** Any CSS colour — design tokens are resolved before handing them to recharts. */
  color: string
}

/**
 * Resource breakdown donut with a total in the middle.
 *
 * Plots only slices the run actually reported; the caller filters out zeroes,
 * so an unreported category simply is not drawn rather than showing as an empty
 * wedge. Recharts needs concrete colour values, so token references are
 * resolved against the document before rendering.
 */
export function ResourceDonut({ slices, total }: { slices: ResourceSlice[]; total: number }) {
  const resolve = (color: string) => {
    const match = /^var\((--[^)]+)\)$/.exec(color.trim())
    if (!match || typeof window === "undefined") return color
    return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color
  }

  return (
    <div className="resource-donut">
      <div className="resource-donut-chart">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.name} fill={resolve(slice.color)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="resource-donut-center">
          <span className="resource-donut-total">{total}</span>
          <span className="resource-donut-total-label">Total</span>
        </div>
      </div>

      <ul className="resource-donut-legend">
        {slices.map((slice) => (
          <li key={slice.name} className="resource-donut-legend-item">
            <span
              className="resource-donut-swatch"
              style={{ backgroundColor: slice.color }}
              aria-hidden="true"
            />
            <span className="resource-donut-legend-name">{slice.name}</span>
            <span className="resource-donut-legend-value">
              {slice.value}
              {total > 0 ? ` (${Math.round((slice.value / total) * 100)}%)` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
