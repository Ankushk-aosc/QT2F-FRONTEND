"use client"

import React from "react"
import { Divider, Text, makeStyles, tokens } from "@fluentui/react-components"

/**
 * Layout primitives shared by every Administration Center section.
 *
 * Sections describe *what* they configure; spacing, headings and the
 * label/control rhythm live here so all 24 sections stay visually consistent.
 */

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    maxWidth: "760px",
  },
  panelHeader: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  groupHeader: {
    marginBottom: "8px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "24px",
    padding: "14px 16px",
  },
  rowStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: "8px",
  },
  rowText: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  rowControl: {
    flexShrink: 0,
    minWidth: "220px",
    display: "flex",
    justifyContent: "flex-end",
  },
  rowControlStacked: {
    minWidth: 0,
    justifyContent: "flex-start",
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  separator: {
    // Fluent's Divider adds vertical space; rows are already padded.
    marginBlock: 0,
  },
})

export interface SettingsPanelProps {
  title: string
  description: string
  children: React.ReactNode
}

/** Top-level wrapper for a settings section. */
export function SettingsPanel({ title, description, children }: SettingsPanelProps) {
  const styles = useStyles()
  return (
    <div className={styles.panel}>
      <header className={styles.panelHeader}>
        <Text size={600} weight="semibold" as="h2">
          {title}
        </Text>
        <Text size={200} className={styles.hint}>
          {description}
        </Text>
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
  const styles = useStyles()
  const rows = React.Children.toArray(children).filter(Boolean)

  return (
    <section className={styles.group}>
      {title ? (
        <Text size={400} weight="semibold" className={styles.groupHeader}>
          {title}
        </Text>
      ) : null}
      <div className={styles.card}>
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <Divider className={styles.separator} /> : null}
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
  const styles = useStyles()
  return (
    <div className={`${styles.row} ${stacked ? styles.rowStacked : ""}`}>
      <div className={styles.rowText}>
        <Text size={300} weight="semibold">
          {label}
        </Text>
        {hint ? (
          <Text size={200} className={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </div>
      <div className={`${styles.rowControl} ${stacked ? styles.rowControlStacked : ""}`}>
        {children}
      </div>
    </div>
  )
}
