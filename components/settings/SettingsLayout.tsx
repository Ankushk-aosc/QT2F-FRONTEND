"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"

import {
  SETTINGS_GROUPS,
  searchSections,
  type SettingsSection,
  type SettingsSectionId,
} from "@/lib/settings/navigation"
import { useSettingsStore } from "@/stores/settings.store"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

import { SettingsSectionRouter } from "./sections"

/**
 * The Administration Center's navigable body: a searchable section rail beside
 * the selected section.
 *
 * This is the *only* settings surface. It previously lived inside an
 * `OverlayDrawer` opened from the top navigation, which meant settings had no
 * address — an administrator could not link to a section, refresh into one, or
 * use the back button, and a migration screen that wanted to send someone to a
 * specific connector had to reach across and mutate drawer state. Making it a
 * routed page at /settings gives every section a URL, and the drawer was
 * removed rather than kept alongside so there is one way to reach settings.
 *
 * Section selection is owned by the caller so the page can keep it in the URL.
 */

export interface SettingsLayoutProps {
  activeSection: SettingsSectionId
  onSectionChange: (sectionId: SettingsSectionId) => void
}

export function SettingsLayout({ activeSection, onSectionChange }: SettingsLayoutProps) {
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const loading = useSettingsStore((state) => state.loading)
  const loaded = useSettingsStore((state) => state.loaded)
  const saving = useSettingsStore((state) => state.saving)
  const error = useSettingsStore((state) => state.error)
  const clearError = useSettingsStore((state) => state.clearError)

  const [query, setQuery] = useState("")

  // `loadSettings` is a no-op once the document is in memory.
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const matches = useMemo(() => searchSections(query), [query])
  const matchedIds = useMemo(() => new Set(matches.map((section) => section.id)), [matches])

  const groups = useMemo(
    () =>
      SETTINGS_GROUPS.map((group) => ({
        ...group,
        sections: matches.filter((section) => section.group === group.id),
      })).filter((group) => group.sections.length > 0),
    [matches],
  )

  // If a search hides the active section, move to the first visible result so
  // the content pane never shows something the rail no longer offers.
  useEffect(() => {
    if (matches.length > 0 && !matchedIds.has(activeSection)) {
      onSectionChange(matches[0].id as SettingsSectionId)
    }
  }, [matches, matchedIds, activeSection, onSectionChange])

  const handleSelect = (section: SettingsSection) => {
    onSectionChange(section.id as SettingsSectionId)
  }

  return (
    <div className="settings-layout-root">
      {error ? (
        <Alert
          variant="destructive"
          style={{ margin: "0", borderRadius: 0, display: "flex", alignItems: "center", justifyContent: "space-between", flexDirection: "row" }}
        >
          <AlertDescription>{error}</AlertDescription>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button size="sm" onClick={() => void loadSettings(true)}>
              Retry
            </Button>
            <Button variant="ghost" size="icon" aria-label="Dismiss error" onClick={clearError}>
              <X size={16} />
            </Button>
          </div>
        </Alert>
      ) : null}

      <div className="settings-layout-status-bar" aria-live="polite">
        {saving ? (
          <>
            <Spinner size="tiny" />
            <span className="settings-row-hint">Saving…</span>
          </>
        ) : null}
      </div>

      <div className="settings-layout-body">
        <nav className="settings-layout-nav" aria-label="Settings sections">
          <div style={{ position: "relative" }}>
            <Search size={16} className="integrations-search-icon" />
            <Input
              placeholder="Search settings"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search settings"
              style={{ paddingLeft: "32px" }}
            />
          </div>

          {groups.length === 0 ? (
            <span className="settings-layout-empty-nav">No settings match &quot;{query}&quot;.</span>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="settings-layout-nav-group">
                <span className="settings-layout-nav-group-label">{group.label}</span>
                {group.sections.map((section) => {
                  const isActive = section.id === activeSection
                  const isPlanned = section.status === "planned"
                  return (
                    <button
                      key={section.id}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "settings-layout-nav-item",
                        isActive ? "settings-layout-nav-item-active" : "",
                        isPlanned ? "settings-layout-nav-item-planned" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handleSelect(section)}
                    >
                      <span>{section.label}</span>
                      {isPlanned ? <Badge variant="outline">Soon</Badge> : null}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </nav>

        <div className="settings-layout-content">
          {loading && !loaded ? (
            <div className="settings-layout-centered">
              <Spinner size="large" label="Loading settings…" />
            </div>
          ) : (
            <SettingsSectionRouter sectionId={activeSection} />
          )}
        </div>
      </div>
    </div>
  )
}
