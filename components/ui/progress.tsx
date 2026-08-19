import React from "react"

export interface ProgressBarProps {
  /** 0–1 decimal representing completion. Omit for indeterminate. */
  value?: number
}

/** A labelled progress bar. Indeterminate (animated stripe) when `value` is omitted. */
export function ProgressBar({ value }: ProgressBarProps) {
  const determinate = typeof value === "number"
  return (
    <div
      className={determinate ? "ui-progress-track" : "ui-progress-track ui-progress-indeterminate"}
      role="progressbar"
      aria-valuenow={determinate ? Math.round((value as number) * 100) : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {determinate ? (
        <div className="ui-progress-fill" style={{ width: `${Math.max(0, Math.min(1, value as number)) * 100}%` }} />
      ) : (
        <div className="ui-progress-fill ui-progress-fill-indeterminate" />
      )}
    </div>
  )
}
