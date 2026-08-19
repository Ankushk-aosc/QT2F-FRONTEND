import React, { useId } from "react"

export interface FieldProps {
  label: string
  hint?: string
  required?: boolean
  validationState?: "error" | "none"
  validationMessage?: string
  className?: string
  children: React.ReactElement
}

/**
 * Label + control + hint/error, wired together with a real `<label for>` and
 * `aria-describedby`/`aria-invalid` on the control — the accessible plumbing
 * Fluent's `Field` provided implicitly.
 */
export function Field({ label, hint, required, validationState, validationMessage, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = validationMessage ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined
  const hasError = validationState === "error"

  const control = React.cloneElement(children, {
    id,
    "aria-describedby": describedBy,
    "aria-invalid": hasError || undefined,
    "aria-required": required || undefined,
  })

  return (
    <div className={["ui-field", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className="ui-field-label">
        {label}
        {required ? <span className="ui-field-required"> *</span> : null}
      </label>
      {control}
      {hint && !hasError ? (
        <span id={hintId} className="ui-field-hint">
          {hint}
        </span>
      ) : null}
      {hasError && validationMessage ? (
        <span id={errorId} role="alert" className="ui-field-error">
          {validationMessage}
        </span>
      ) : null}
    </div>
  )
}
