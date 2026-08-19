"use client"

import React from "react"
import { Wrench } from "lucide-react"

import type { SettingsSection } from "@/lib/settings/navigation"

import { SettingsPanel } from "../SettingsPrimitives"

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
  return (
    <SettingsPanel title={section.label} description={section.description}>
      <div className="settings-notice">
        <Wrench size={20} strokeWidth={1.75} />
        <div className="settings-notice-text">
          <span className="settings-row-label">Not yet available</span>
          <span className="settings-row-hint">
            This section is part of the Administration Center plan but is not wired up yet. It is
            shown here so the navigation reflects the full scope. Nothing on this screen is saved.
          </span>
        </div>
      </div>
    </SettingsPanel>
  )
}
