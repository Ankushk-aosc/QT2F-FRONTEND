"use client"

import React from "react"
import { Text, makeStyles, tokens } from "@fluentui/react-components"
import { WrenchScrewdriver24Regular } from "@fluentui/react-icons"

import type { SettingsSection } from "@/lib/settings/navigation"

import { SettingsPanel } from "../SettingsPrimitives"

const useStyles = makeStyles({
  notice: {
    display: "flex",
    gap: "12px",
    padding: "16px",
    borderRadius: tokens.borderRadiusMedium,
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
  },
  noticeText: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  hint: { color: tokens.colorNeutralForeground3 },
})

/**
 * Rendered for sections that are part of the agreed admin menu but not yet
 * implemented.
 *
 * This deliberately shows nothing that looks editable. A disabled form that
 * silently discards input is worse than an honest empty state, because an
 * administrator could believe they had configured something that was never
 * saved.
 */
export function PlannedSection({ section }: { section: SettingsSection }) {
  const styles = useStyles()

  return (
    <SettingsPanel title={section.label} description={section.description}>
      <div className={styles.notice}>
        <WrenchScrewdriver24Regular />
        <div className={styles.noticeText}>
          <Text size={300} weight="semibold">
            Not yet available
          </Text>
          <Text size={200} className={styles.hint}>
            This section is part of the Administration Center plan but is not wired up yet. It is
            shown here so the navigation reflects the full scope. Nothing on this screen is saved.
          </Text>
        </div>
      </div>
    </SettingsPanel>
  )
}
