"use client"

import React from "react"
import { Dropdown, Option, Switch, Text, makeStyles, tokens } from "@fluentui/react-components"

import {
  DASHBOARD_LAYOUT_OPTIONS,
  WORKSPACE_OPTIONS,
  type SettingOption,
} from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"
import { useUIStore } from "@/stores/ui.store"
import type { DashboardLayout, WorkspaceKind, WorkspaceSettings } from "@/types/settings"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

const useStyles = makeStyles({
  fullWidth: { width: "100%" },
  hint: { color: tokens.colorNeutralForeground3 },
})

export function WorkspaceSection() {
  const styles = useStyles()
  const workspace = useSettingsStore((state) => state.settings.workspace)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  // The *active* workspace stays owned by ui.store, which the migration tabs
  // already read. This section configures the defaults that seed it.
  const activeWorkspace = useUIStore((state) => state.workspace)
  const setActiveWorkspace = useUIStore((state) => state.setWorkspace)

  const patch = (change: Partial<WorkspaceSettings>) => void updateSettings({ workspace: change })

  const labelFor = <T extends string>(options: readonly SettingOption<T>[], value: T): string =>
    options.find((option) => option.value === value)?.label ?? value

  const handleActiveWorkspaceChange = (next: WorkspaceKind) => {
    setActiveWorkspace(next)
    // Record it as the last workspace so "restore on sign-in" has something to
    // restore, but only when the administrator asked us to remember it.
    if (workspace.rememberLastWorkspace) {
      patch({ lastWorkspace: next })
    }
  }

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
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(WORKSPACE_OPTIONS, activeWorkspace)}
            selectedOptions={[activeWorkspace]}
            onOptionSelect={(_, data) =>
              data.optionValue && handleActiveWorkspaceChange(data.optionValue as WorkspaceKind)
            }
          >
            {WORKSPACE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Startup">
        <SettingRow label="Default workspace" hint="Used when there is no workspace to restore.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(WORKSPACE_OPTIONS, workspace.defaultWorkspace)}
            selectedOptions={[workspace.defaultWorkspace]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ defaultWorkspace: data.optionValue as WorkspaceKind })
            }
          >
            {WORKSPACE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
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
            onChange={(_, data) =>
              patch({
                rememberLastWorkspace: data.checked,
                // Clear the stored value when the operator opts out, so we are
                // not holding on to state they asked us to forget.
                ...(data.checked ? {} : { lastWorkspace: null }),
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
            onChange={(_, data) => patch({ autoRestoreWorkspace: data.checked })}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Dashboard">
        <SettingRow label="Layout" hint="How migration items are arranged on the dashboard.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(DASHBOARD_LAYOUT_OPTIONS, workspace.dashboardLayout)}
            selectedOptions={[workspace.dashboardLayout]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ dashboardLayout: data.optionValue as DashboardLayout })
            }
          >
            {DASHBOARD_LAYOUT_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>
      </SettingsGroup>

      <Text size={200} className={styles.hint}>
        Density and card styling for this dashboard are configured under Appearance.
      </Text>
    </SettingsPanel>
  )
}
