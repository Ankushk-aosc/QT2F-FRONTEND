"use client"

import React from "react"

import { SETTINGS_SECTIONS } from "@/lib/settings/navigation"
import { useSettingsStore } from "@/stores/settings.store"
import { Badge } from "@/components/ui/badge"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

export function AboutSection() {
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
          <span>MigrateIQ</span>
        </SettingRow>

        <SettingRow label="Application version" hint="Read from the running build at runtime.">
          <span style={{ fontFamily: "monospace" }}>{applicationVersion || "—"}</span>
        </SettingRow>

        <SettingRow label="Settings schema" hint="Version of the persisted settings document.">
          <span style={{ fontFamily: "monospace" }}>v{schemaVersion}</span>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Configuration">
        <SettingRow label="Settings last saved" hint="Timestamp of the most recent change.">
          <span>{formattedUpdatedAt}</span>
        </SettingRow>

        <SettingRow
          label="Administration sections"
          hint="Sections currently wired up versus the full planned menu."
        >
          <Badge variant="secondary">
            {availableCount} of {totalCount} available
          </Badge>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  )
}
