"use client"

import React from "react"

/**
 * Layout primitives shared by every Administration Center section.
 *
 * Sections describe *what* they configure; spacing, headings and the
 * label/control rhythm live here so all 24 sections stay visually consistent.
 * Backed by `.settings-*` classes in globals.css rather than Fluent's
 * `makeStyles`/`tokens`.
 */

export interface SettingsPanelProps {
  title: string
  description: string
  children: React.ReactNode
}

/** Top-level wrapper for a settings section. */
export function SettingsPanel({ title, description, children }: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <header className="settings-panel-header">
        <h2 className="settings-panel-title">{title}</h2>
        <p className="settings-panel-description">{description}</p>
      </header>
      {children}
    </div>
  )
}

export interface SettingsGroupProps {
  /** Optional heading rendered above the card. */
  title?: string
  children: React.ReactNode
}

/** A titled card containing a set of related setting rows. */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  const rows = React.Children.toArray(children).filter(Boolean)

  return (
    <section className="settings-group">
      {title ? <h3 className="settings-group-header">{title}</h3> : null}
      <div className="settings-card">
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <hr className="settings-separator" /> : null}
            {row}
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}

export interface SettingRowProps {
  label: string
  /** Secondary line explaining what the setting does or its current value. */
  hint?: string
  /**
   * Render the control on its own line beneath the label. Use for wide controls
   * such as a colour picker or a long text field.
   */
  stacked?: boolean
  children: React.ReactNode
}

/** A single label/control pair inside a `SettingsGroup`. */
export function SettingRow({ label, hint, stacked = false, children }: SettingRowProps) {
  return (
    <div className={`settings-row${stacked ? " settings-row-stacked" : ""}`}>
      <div className="settings-row-text">
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </div>
      <div className={`settings-row-control${stacked ? " settings-row-control-stacked" : ""}`}>
        {children}
      </div>
    </div>
  )
}
