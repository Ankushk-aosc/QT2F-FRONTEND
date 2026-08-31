import React from "react"

const SIZE_PX: Record<string, number> = {
  tiny: 12,
  "extra-small": 16,
  small: 20,
  medium: 28,
  large: 36,
  "extra-large": 48,
}

export interface SpinnerProps {
  size?: "tiny" | "extra-small" | "small" | "medium" | "large" | "extra-large"
  label?: string
  className?: string
  style?: React.CSSProperties
}

/** A CSS-only loading indicator — one rotating ring, no library. */
export function Spinner({ size = "medium", label, className, style }: SpinnerProps) {
  const px = SIZE_PX[size] ?? 28
  return (
    <div className={className} style={{ display: "inline-flex", flexDirection: label ? "column" : "row", alignItems: "center", gap: "8px", ...style }}>
      <div
        role="status"
        aria-label={label || "Loading"}
        className="ui-spinner"
        style={{ width: px, height: px, borderWidth: Math.max(2, Math.round(px / 10)) }}
      />
      {label ? <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{label}</span> : null}
    </div>
  )
}
