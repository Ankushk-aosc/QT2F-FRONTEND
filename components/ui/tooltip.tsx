import React, { useId } from "react"

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  /** Accepted for API compatibility with the previous Fluent usage; not otherwise used. */
  relationship?: "label" | "description"
  withArrow?: boolean
}

/**
 * A hover/focus tooltip. Pure CSS (`:hover`/`:focus-visible` in globals.css)
 * rather than a portal — simpler, and it means the tooltip disappears for
 * free whenever its trigger does, with no leaked listeners to clean up.
 * `aria-describedby` links the two for screen readers the same way Fluent's
 * `Tooltip` did.
 */
export function Tooltip({ content, children, relationship = "description" }: TooltipProps) {
  const id = useId()

  return (
    <span className="ui-tooltip-wrapper">
      {React.cloneElement(children, {
        "aria-describedby": id,
      })}
      <span role={relationship === "label" ? undefined : "tooltip"} id={id} className="ui-tooltip-bubble">
        {content}
      </span>
    </span>
  )
}
