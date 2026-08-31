"use client"

import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, Bell, CircleCheck, Mail, Upload, X } from "lucide-react"

import { SUPPORTED_TIMEZONES } from "@/lib/constants"
import {
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  THEME_MODE_OPTIONS,
} from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"
import type { ThemeMode } from "@/types/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tooltip } from "@/components/ui/tooltip"

import { SettingRow, SettingsPanel } from "../SettingsPrimitives"
import { SettingsFooter } from "../SettingsFooter"

/**
 * Rows the reference layout calls for that this platform has no setting behind.
 * They render disabled and say so, rather than pretending to persist a choice.
 */
const UNSUPPORTED_HINT = "Not configurable in this deployment"

const NOTIFICATION_ROWS = [
  {
    id: "email",
    icon: Mail,
    label: "Email Notifications",
    description: "Receive email updates about migration runs and alerts.",
  },
  {
    id: "system",
    icon: Bell,
    label: "System Alerts",
    description: "Get notified about system issues and maintenance.",
  },
  {
    id: "completion",
    icon: CircleCheck,
    label: "Run Completion",
    description: "Receive notifications when migration runs complete.",
  },
  {
    id: "failure",
    icon: AlertTriangle,
    label: "Failure Alerts",
    description: "Instant alerts when migration runs fail.",
  },
] as const

const MAX_LOGO_BYTES = 1_000_000

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
  const [draft, setDraft] = useState(value)

  // Re-sync when the stored value changes underneath us (e.g. after a reload
  // or a rejected save that rolled back).
  useEffect(() => setDraft(value), [value])

  const commit = () => {
    if (draft !== value) onCommit(draft)
  }

  return (
    <Input
      style={{ width: "100%" }}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/** Square logo preview: the uploaded image, or initials from the company/platform name. */
function LogoPreview({ logoUrl, name }: { logoUrl: string; name: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a locally-uploaded data: URL, not an optimizable remote asset
    return <img src={logoUrl} alt="" className="general-logo-preview" />
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <div className="general-logo-preview general-logo-fallback" aria-hidden="true">
      {initial}
    </div>
  )
}

/** A control the layout calls for that this deployment has no setting behind. */
function UnsupportedSelect({ label, reason }: { label: string; reason: string }) {
  return (
    <Tooltip content={reason}>
      <span className="settings-disabled-wrap">
        <Select value="" disabled aria-label={label}>
          <SelectItem value="">Not configured</SelectItem>
        </Select>
      </span>
    </Tooltip>
  )
}

export function GeneralSection() {
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

  return (
    <SettingsPanel
      title="General Settings"
      description="Manage your platform identity and regional preferences."
    >
      <div className="settings-card settings-two-col">
        <div className="settings-col">
          <SettingRow label="Company Name" hint="Shown in reports and exported documents." stacked>
            <DraftInput
              value={general.companyName}
              placeholder="e.g. Contoso Group"
              onCommit={(companyName) => void updateSettings({ general: { companyName } })}
            />
          </SettingRow>

          <SettingRow label="Platform Name" hint="Displayed in the navigation bar and page titles." stacked>
            <DraftInput
              value={general.platformName}
              placeholder="MigrateIQ"
              onCommit={(platformName) => void updateSettings({ general: { platformName } })}
            />
          </SettingRow>

          <SettingRow label="Logo" hint="PNG, JPG, SVG or WebP up to 1 MB." stacked>
            <div className="general-logo-row">
              <LogoPreview logoUrl={general.logoUrl} name={general.companyName || general.platformName} />
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
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
                {general.logoUrl ? "Replace Logo" : "Upload New Logo"}
              </Button>
              {general.logoUrl ? (
                <Button variant="ghost" onClick={() => void updateSettings({ general: { logoUrl: "" } })}>
                  <X size={16} />
                  Remove
                </Button>
              ) : null}
            </div>
            {logoError ? <span className="ui-field-error">{logoError}</span> : null}
          </SettingRow>
        </div>

        <div className="settings-col">
          <SettingRow label="Language" hint="Select your preferred language." stacked>
            <Select
              value={general.language}
              aria-label="Language"
              onValueChange={(value: string) => void updateSettings({ general: { language: value } })}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </SettingRow>

          <SettingRow label="Region" hint={UNSUPPORTED_HINT} stacked>
            <UnsupportedSelect label="Region" reason="This platform stores no region setting" />
          </SettingRow>

          <SettingRow label="Time Zone" hint="Used for run history, logs and scheduled reports." stacked>
            <Select
              value={general.timezone}
              aria-label="Time Zone"
              onValueChange={(value: string) => void updateSettings({ general: { timezone: value } })}
            >
              {timezoneOptions.map((timezone) => (
                <SelectItem key={timezone} value={timezone}>
                  {timezone}
                </SelectItem>
              ))}
            </Select>
          </SettingRow>
        </div>
      </div>

      <div className="settings-two-col-cards">
        <section className="settings-subcard">
          <header className="settings-subcard-head">
            <h3 className="settings-subcard-title">Regional Settings</h3>
            <p className="settings-subcard-description">
              Configure regional formats and data preferences.
            </p>
          </header>

          <SettingRow label="Date Format" hint="How timestamps are rendered across the platform." stacked>
            <Select
              value={general.dateFormat}
              aria-label="Date Format"
              onValueChange={(value: string) => void updateSettings({ general: { dateFormat: value } })}
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </SettingRow>

          <SettingRow label="Number Format" hint={UNSUPPORTED_HINT} stacked>
            <UnsupportedSelect
              label="Number Format"
              reason="This platform stores no number-format setting"
            />
          </SettingRow>

          <SettingRow label="Week Start Day" hint={UNSUPPORTED_HINT} stacked>
            <UnsupportedSelect
              label="Week Start Day"
              reason="This platform stores no week-start setting"
            />
          </SettingRow>
        </section>

        <section className="settings-subcard">
          <header className="settings-subcard-head">
            <h3 className="settings-subcard-title">Notifications</h3>
            <p className="settings-subcard-description">
              Control how you receive important updates and alerts.
            </p>
          </header>

          {NOTIFICATION_ROWS.map(({ id, icon: Icon, label, description }) => (
            <div key={id} className="notification-row">
              <span className="notification-icon" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="notification-text">
                <span className="notification-label">{label}</span>
                <span className="notification-description">{description}</span>
              </span>
              <Switch
                checked={false}
                disabled
                onChange={() => {}}
                aria-label={`${label} (not configurable in this deployment)`}
              />
            </div>
          ))}

          <p className="notification-note">
            Notification delivery is not configured for this deployment, so these cannot be enabled yet.
          </p>
        </section>
      </div>

      <div className="settings-card settings-two-col">
        <div className="settings-col">
          <SettingRow label="Theme" hint="Also configurable, with more options, under Appearance." stacked>
            <Select
              value={themeMode}
              aria-label="Theme"
              onValueChange={(value: string) =>
                void updateSettings({ appearance: { themeMode: value as ThemeMode } })
              }
            >
              {THEME_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </Select>
          </SettingRow>
        </div>
        <div className="settings-col">
          <SettingRow label="Application version" hint="Read from the running build." stacked>
            <span style={{ fontFamily: "monospace", fontSize: "var(--text-base)" }}>
              {applicationVersion || "—"}
            </span>
          </SettingRow>
        </div>
      </div>

      <SettingsFooter />
    </SettingsPanel>
  )
}
