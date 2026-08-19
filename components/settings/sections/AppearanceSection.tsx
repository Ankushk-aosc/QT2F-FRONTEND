"use client"

import React from "react"

import {
  ACCENT_COLOR_OPTIONS,
  ACCENT_COLOR_SWATCHES,
  CARD_STYLE_OPTIONS,
  DASHBOARD_DENSITY_OPTIONS,
  FONT_SIZE_OPTIONS,
  SIDEBAR_STYLE_OPTIONS,
  THEME_MODE_OPTIONS,
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
import { Select, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip } from "@/components/ui/tooltip"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

export function AppearanceSection() {
  const appearance = useSettingsStore((state) => state.settings.appearance)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  const patch = (change: Partial<AppearanceSettings>) => void updateSettings({ appearance: change })

  return (
    <SettingsPanel
      title="Appearance"
      description="Theme, colour and density preferences. Changes apply immediately and are saved for this platform."
    >
      <SettingsGroup title="Theme">
        <SettingRow label="Colour scheme" hint="System follows your operating system setting.">
          <Select
            value={appearance.themeMode}
            onValueChange={(value: string) => patch({ themeMode: value as ThemeMode })}
          >
            {THEME_MODE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </SettingRow>

        <SettingRow label="Accent colour" hint="Used for primary actions and highlights." stacked>
          <div className="appearance-swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENT_COLOR_OPTIONS.map((option) => {
              const selected = appearance.accentColor === option.value
              return (
                <Tooltip key={option.value} content={option.label} relationship="label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    className={`appearance-swatch${selected ? " appearance-swatch-selected" : ""}`}
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
          <Select value={appearance.fontSize} onValueChange={(value: string) => patch({ fontSize: value as FontSize })}>
            {FONT_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </SettingRow>

        <SettingRow label="Sidebar style" hint="How the left navigation is presented.">
          <Select
            value={appearance.sidebarStyle}
            onValueChange={(value: string) => patch({ sidebarStyle: value as SidebarStyle })}
          >
            {SIDEBAR_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </SettingRow>

        <SettingRow label="Card style" hint="Applies to dashboard and result cards.">
          <Select value={appearance.cardStyle} onValueChange={(value: string) => patch({ cardStyle: value as CardStyle })}>
            {CARD_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </SettingRow>

        <SettingRow label="Dashboard density" hint="Controls spacing between dashboard items.">
          <Select
            value={appearance.dashboardDensity}
            onValueChange={(value: string) => patch({ dashboardDensity: value as DashboardDensity })}
          >
            {DASHBOARD_DENSITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Behaviour">
        <SettingRow label="Compact mode" hint="Reduces padding throughout the interface.">
          <Switch checked={appearance.compactMode} onChange={(checked) => patch({ compactMode: checked })} />
        </SettingRow>

        <SettingRow
          label="Animations"
          hint="Turn off to reduce motion. Recommended if you find movement distracting."
        >
          <Switch
            checked={appearance.animationsEnabled}
            onChange={(checked) => patch({ animationsEnabled: checked })}
          />
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  )
}
