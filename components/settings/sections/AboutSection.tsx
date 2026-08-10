"use client"

import React from "react"
import { Badge, Text, makeStyles, tokens } from "@fluentui/react-components"

import { SETTINGS_SECTIONS } from "@/lib/settings/navigation"
import { useSettingsStore } from "@/stores/settings.store"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

const useStyles = makeStyles({
  mono: { fontFamily: tokens.fontFamilyMonospace },
})

export function AboutSection() {
  const styles = useStyles()
  const applicationVersion = useSettingsStore((state) => state.applicationVersion)
  const updatedAt = useSettingsStore((state) => state.updatedAt)
  const schemaVersion = useSettingsStore((state) => state.settings.schemaVersion)

  const availableCount = SETTINGS_SECTIONS.filter((s) => s.status === "available").length
  const totalCount = SETTINGS_SECTIONS.length

  const formattedUpdatedAt = updatedAt
    ? new Date(updatedAt).toLocaleString()
    : "No changes saved yet"

  return (
    <SettingsPanel
      title="About"
      description="Build and configuration information for this deployment."
    >
      <SettingsGroup title="Build">
        <SettingRow label="Platform" hint="Unified Qlik and Tableau migration platform.">
          <Text size={300}>Switchblade Unified Platform</Text>
        </SettingRow>

        <SettingRow label="Application version" hint="Read from the running build at runtime.">
          <Text size={300} className={styles.mono}>
            {applicationVersion || "—"}
          </Text>
        </SettingRow>

        <SettingRow label="Settings schema" hint="Version of the persisted settings document.">
          <Text size={300} className={styles.mono}>
            v{schemaVersion}
          </Text>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Configuration">
        <SettingRow label="Settings last saved" hint="Timestamp of the most recent change.">
          <Text size={300}>{formattedUpdatedAt}</Text>
        </SettingRow>

        <SettingRow
          label="Administration sections"
          hint="Sections currently wired up versus the full planned menu."
        >
          <Badge appearance="tint" color="informative">
            {availableCount} of {totalCount} available
          </Badge>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  )
}
