"use client"

import React from "react"
import { Dropdown, Option, Switch, Tooltip, makeStyles, tokens } from "@fluentui/react-components"

import {
  ACCENT_COLOR_OPTIONS,
  ACCENT_COLOR_SWATCHES,
  CARD_STYLE_OPTIONS,
  DASHBOARD_DENSITY_OPTIONS,
  FONT_SIZE_OPTIONS,
  SIDEBAR_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
  type SettingOption,
} from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"
import type {
  AccentColor,
  AppearanceSettings,
  CardStyle,
  DashboardDensity,
  FontSize,
  SidebarStyle,
  ThemeMode,
} from "@/types/settings"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

const useStyles = makeStyles({
  fullWidth: { width: "100%" },
  swatches: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  swatch: {
    width: "32px",
    height: "32px",
    borderRadius: tokens.borderRadiusMedium,
    border: `2px solid transparent`,
    cursor: "pointer",
    padding: 0,
    outlineOffset: "2px",
    ":hover": {
      transform: "scale(1.08)",
    },
  },
  swatchSelected: {
    border: `2px solid ${tokens.colorNeutralForeground1}`,
  },
})

export function AppearanceSection() {
  const styles = useStyles()
  const appearance = useSettingsStore((state) => state.settings.appearance)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  const patch = (change: Partial<AppearanceSettings>) => void updateSettings({ appearance: change })

  const labelFor = <T extends string>(options: readonly SettingOption<T>[], value: T): string =>
    options.find((option) => option.value === value)?.label ?? value

  return (
    <SettingsPanel
      title="Appearance"
      description="Theme, colour and density preferences. Changes apply immediately and are saved for this platform."
    >
      <SettingsGroup title="Theme">
        <SettingRow label="Colour scheme" hint="System follows your operating system setting.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(THEME_MODE_OPTIONS, appearance.themeMode)}
            selectedOptions={[appearance.themeMode]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ themeMode: data.optionValue as ThemeMode })
            }
          >
            {THEME_MODE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Accent colour" hint="Used for primary actions and highlights." stacked>
          <div className={styles.swatches} role="radiogroup" aria-label="Accent colour">
            {ACCENT_COLOR_OPTIONS.map((option) => {
              const selected = appearance.accentColor === option.value
              return (
                <Tooltip key={option.value} content={option.label} relationship="label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    className={`${styles.swatch} ${selected ? styles.swatchSelected : ""}`}
                    style={{ backgroundColor: ACCENT_COLOR_SWATCHES[option.value as AccentColor] }}
                    onClick={() => patch({ accentColor: option.value as AccentColor })}
                  />
                </Tooltip>
              )
            })}
          </div>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Layout">
        <SettingRow label="Font size" hint="Scales text across the whole platform.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(FONT_SIZE_OPTIONS, appearance.fontSize)}
            selectedOptions={[appearance.fontSize]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ fontSize: data.optionValue as FontSize })
            }
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Sidebar style" hint="How the left navigation is presented.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(SIDEBAR_STYLE_OPTIONS, appearance.sidebarStyle)}
            selectedOptions={[appearance.sidebarStyle]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ sidebarStyle: data.optionValue as SidebarStyle })
            }
          >
            {SIDEBAR_STYLE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Card style" hint="Applies to dashboard and result cards.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(CARD_STYLE_OPTIONS, appearance.cardStyle)}
            selectedOptions={[appearance.cardStyle]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ cardStyle: data.optionValue as CardStyle })
            }
          >
            {CARD_STYLE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Dashboard density" hint="Controls spacing between dashboard items.">
          <Dropdown
            className={styles.fullWidth}
            value={labelFor(DASHBOARD_DENSITY_OPTIONS, appearance.dashboardDensity)}
            selectedOptions={[appearance.dashboardDensity]}
            onOptionSelect={(_, data) =>
              data.optionValue && patch({ dashboardDensity: data.optionValue as DashboardDensity })
            }
          >
            {DASHBOARD_DENSITY_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Behaviour">
        <SettingRow label="Compact mode" hint="Reduces padding throughout the interface.">
          <Switch
            checked={appearance.compactMode}
            onChange={(_, data) => patch({ compactMode: data.checked })}
          />
        </SettingRow>

        <SettingRow
          label="Animations"
          hint="Turn off to reduce motion. Recommended if you find movement distracting."
        >
          <Switch
            checked={appearance.animationsEnabled}
            onChange={(_, data) => patch({ animationsEnabled: data.checked })}
          />
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  )
}
