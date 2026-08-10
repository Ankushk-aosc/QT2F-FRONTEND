"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  Avatar,
  Button,
  Dropdown,
  Input,
  Option,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components"
import { ArrowUpload24Regular, Dismiss16Regular } from "@fluentui/react-icons"

import { SUPPORTED_TIMEZONES } from "@/lib/constants"
import {
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  THEME_MODE_OPTIONS,
} from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"
import type { ThemeMode } from "@/types/settings"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

const MAX_LOGO_BYTES = 1_000_000

const useStyles = makeStyles({
  fullWidth: { width: "100%" },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
  },
  hint: { color: tokens.colorNeutralForeground3 },
  error: { color: tokens.colorPaletteRedForeground1 },
  version: {
    fontFamily: tokens.fontFamilyMonospace,
  },
})

/**
 * A text input that keeps local keystrokes and commits on blur or Enter,
 * so typing a company name does not issue a request per character.
 */
function DraftInput({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder?: string
  onCommit: (next: string) => void
}) {
  const styles = useStyles()
  const [draft, setDraft] = useState(value)

  // Re-sync when the stored value changes underneath us (e.g. after a reload
  // or a rejected save that rolled back).
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    if (draft !== value) onCommit(draft)
  }

  return (
    <Input
      className={styles.fullWidth}
      value={draft}
      placeholder={placeholder}
      onChange={(_, data) => setDraft(data.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function GeneralSection() {
  const styles = useStyles()
  const general = useSettingsStore((state) => state.settings.general)
  const themeMode = useSettingsStore((state) => state.settings.appearance.themeMode)
  const applicationVersion = useSettingsStore((state) => state.applicationVersion)
  const updateSettings = useSettingsStore((state) => state.updateSettings)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  // The stored timezone may come from browser detection and not be in the
  // curated list, so make sure it is always selectable.
  const timezoneOptions = React.useMemo(() => {
    const options = [...SUPPORTED_TIMEZONES] as string[]
    if (general.timezone && !options.includes(general.timezone)) {
      options.unshift(general.timezone)
    }
    return options
  }, [general.timezone])

  const handleLogoSelected = (file: File | undefined) => {
    setLogoError(null)
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file.")
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo must be 1 MB or smaller.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (result) void updateSettings({ general: { logoUrl: result } })
    }
    reader.onerror = () => setLogoError("Could not read that file.")
    reader.readAsDataURL(file)
  }

  const dateFormatLabel =
    DATE_FORMAT_OPTIONS.find((option) => option.value === general.dateFormat)?.label ??
    general.dateFormat

  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === general.language)?.label ?? general.language

  const themeLabel =
    THEME_MODE_OPTIONS.find((option) => option.value === themeMode)?.label ?? themeMode

  return (
    <SettingsPanel
      title="General"
      description="Identity and regional defaults for this deployment of the platform."
    >
      <SettingsGroup title="Identity">
        <SettingRow label="Company name" hint="Shown in reports and exported documents." stacked>
          <DraftInput
            value={general.companyName}
            placeholder="e.g. Contoso Group"
            onCommit={(companyName) => void updateSettings({ general: { companyName } })}
          />
        </SettingRow>

        <SettingRow label="Platform name" hint="Displayed in the navigation bar and page titles." stacked>
          <DraftInput
            value={general.platformName}
            placeholder="Switchblade Unified Platform"
            onCommit={(platformName) => void updateSettings({ general: { platformName } })}
          />
        </SettingRow>

        <SettingRow label="Logo" hint="PNG, JPG, SVG or WebP up to 1 MB." stacked>
          <div className={styles.logoRow}>
            <Avatar
              image={general.logoUrl ? { src: general.logoUrl } : undefined}
              name={general.companyName || general.platformName}
              shape="square"
              size={40}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              hidden
              onChange={(event) => {
                handleLogoSelected(event.target.files?.[0])
                // Allow re-selecting the same file after a failed attempt.
                event.target.value = ""
              }}
            />
            <Button
              icon={<ArrowUpload24Regular />}
              onClick={() => fileInputRef.current?.click()}
            >
              {general.logoUrl ? "Replace" : "Upload"}
            </Button>
            {general.logoUrl ? (
              <Button
                appearance="subtle"
                icon={<Dismiss16Regular />}
                onClick={() => void updateSettings({ general: { logoUrl: "" } })}
              >
                Remove
              </Button>
            ) : null}
          </div>
          {logoError ? (
            <Text size={200} className={styles.error}>
              {logoError}
            </Text>
          ) : null}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Regional">
        <SettingRow label="Language" hint={languageLabel}>
          <Dropdown
            className={styles.fullWidth}
            value={languageLabel}
            selectedOptions={[general.language]}
            onOptionSelect={(_, data) =>
              data.optionValue && void updateSettings({ general: { language: data.optionValue } })
            }
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Timezone" hint="Used for run history, logs and scheduled reports.">
          <Dropdown
            className={styles.fullWidth}
            value={general.timezone}
            selectedOptions={[general.timezone]}
            onOptionSelect={(_, data) =>
              data.optionValue && void updateSettings({ general: { timezone: data.optionValue } })
            }
          >
            {timezoneOptions.map((timezone) => (
              <Option key={timezone} value={timezone}>
                {timezone}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Date format" hint="How timestamps are rendered across the platform.">
          <Dropdown
            className={styles.fullWidth}
            value={dateFormatLabel}
            selectedOptions={[general.dateFormat]}
            onOptionSelect={(_, data) =>
              data.optionValue && void updateSettings({ general: { dateFormat: data.optionValue } })
            }
          >
            {DATE_FORMAT_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value} text={option.label}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Platform">
        <SettingRow label="Theme" hint="Also configurable, with more options, under Appearance.">
          <Dropdown
            className={styles.fullWidth}
            value={themeLabel}
            selectedOptions={[themeMode]}
            onOptionSelect={(_, data) =>
              data.optionValue &&
              void updateSettings({ appearance: { themeMode: data.optionValue as ThemeMode } })
            }
          >
            {THEME_MODE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </SettingRow>

        <SettingRow label="Application version" hint="Read from the running build.">
          <Text size={300} className={styles.version}>
            {applicationVersion || "—"}
          </Text>
        </SettingRow>
      </SettingsGroup>
    </SettingsPanel>
  )
}
