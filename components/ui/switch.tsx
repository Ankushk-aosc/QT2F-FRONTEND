import React from "react"

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  "aria-label"?: string
  id?: string
}

/** A boolean toggle. A native checkbox underneath, styled as a switch — keyboard and screen-reader behavior come for free. */
export function Switch({ checked, onChange, disabled, id, ...props }: SwitchProps) {
  return (
    <label className="ui-switch" data-disabled={disabled || undefined}>
      <input
        type="checkbox"
        id={id}
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...props}
      />
      <span className="ui-switch-track" aria-hidden="true">
        <span className="ui-switch-thumb" />
      </span>
    </label>
  )
}
