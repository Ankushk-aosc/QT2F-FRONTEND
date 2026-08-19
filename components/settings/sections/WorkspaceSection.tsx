"use client"

import React from "react"

import {
  DASHBOARD_LAYOUT_OPTIONS,
  WORKSPACE_OPTIONS,
  type SettingOption,
} from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"
import { useUIStore } from "@/stores/ui.store"
import { Select, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { DashboardLayout, WorkspaceKind, WorkspaceSettings } from "@/types/settings"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

export function WorkspaceSection() {
  const workspace = useSettingsStore((state) => state.settings.workspace)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  // The *active* workspace stays owned by ui.store, which the migration tabs
  // already read. This section configures the defaults that seed it.
  const activeWorkspace = useUIStore((state) => state.workspace)
  const setActiveWorkspace = useUIStore((state) => state.setWorkspace)

  const patch = (change: Partial<WorkspaceSettings>) => void updateSettings({ workspace: change })

  const handleActiveWorkspaceChange = (next: WorkspaceKind) => {
    setActiveWorkspace(next)
    // Record it as the last workspace so "restore on sign-in" has something to
    // restore, but only when the administrator asked us to remember it.
    if (workspace.rememberLastWorkspace) {
      patch({ lastWorkspace: next })
    }
  }

  const renderOptions = <T extends string>(options: readonly SettingOption<T>[]) =>
    options.map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))

  const labelFor = <T extends string>(options: readonly SettingOption<T>[], value: T): string =>
    options.find((option) => option.value === value)?.label ?? value

  return (
    <SettingsPanel
      title="Workspace"
      description="Which migration workspace the platform opens in, and how its dashboard is laid out."
    >
      <SettingsGroup title="Active workspace">
        <SettingRow
          label="Current workspace"
          hint="Switches the platform between the Qlik and Tableau migration experiences."
        >
          <Select
            value={activeWorkspace}
            onValueChange={(value: string) => handleActiveWorkspaceChange(value as WorkspaceKind)}
          >
            {renderOptions(WORKSPACE_OPTIONS)}
          </Select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Startup">
        <SettingRow label="Default workspace" hint="Used when there is no workspace to restore.">
          <Select
            value={workspace.defaultWorkspace}
            onValueChange={(value: string) => patch({ defaultWorkspace: value as WorkspaceKind })}
          >
            {renderOptions(WORKSPACE_OPTIONS)}
          </Select>
        </SettingRow>

        <SettingRow
          label="Remember last workspace"
          hint={
            workspace.lastWorkspace
              ? `Last used: ${labelFor(WORKSPACE_OPTIONS, workspace.lastWorkspace)}`
              : "No workspace recorded yet."
          }
        >
          <Switch
            checked={workspace.rememberLastWorkspace}
            onChange={(checked) =>
              patch({
                rememberLastWorkspace: checked,
                // Clear the stored value when the operator opts out, so we are
                // not holding on to state they asked us to forget.
                ...(checked ? {} : { lastWorkspace: null }),
              })
            }
          />
        </SettingRow>

        <SettingRow
          label="Restore on sign-in"
          hint="Reopen the remembered workspace automatically. Requires 'Remember last workspace'."
        >
          <Switch
            checked={workspace.autoRestoreWorkspace && workspace.rememberLastWorkspace}
            disabled={!workspace.rememberLastWorkspace}
            onChange={(checked) => patch({ autoRestoreWorkspace: checked })}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Dashboard">
        <SettingRow label="Layout" hint="How migration items are arranged on the dashboard.">
          <Select
            value={workspace.dashboardLayout}
            onValueChange={(value: string) => patch({ dashboardLayout: value as DashboardLayout })}
          >
            {renderOptions(DASHBOARD_LAYOUT_OPTIONS)}
          </Select>
        </SettingRow>
      </SettingsGroup>

      <p className="settings-row-hint">
        Density and card styling for this dashboard are configured under Appearance.
      </p>
    </SettingsPanel>
  )
}
