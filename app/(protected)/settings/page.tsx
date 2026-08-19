"use client"

import React, { Suspense, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SettingsLayout } from "@/components/settings/SettingsLayout"
import { Breadcrumbs } from "@/components/layout/Breadcrumbs"
import { Spinner } from "@/components/ui/spinner"
import {
  DEFAULT_SECTION_ID,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/settings/navigation"
import { isConnectorId } from "@/lib/connectors/registry"
import { useSettingsStore } from "@/stores/settings.store"

/**
 * /settings — the Administration Center.
 *
 * Section selection lives in the query string (`?section=integrations`) so a
 * section can be linked to, refreshed into and reached with the back button.
 * `?connector=qlik` additionally asks the Integrations section to open one
 * connector directly, which is how a blocked migration screen sends an
 * administrator to exactly the connector that is stopping them.
 *
 * The store still holds the active section — the settings components already
 * read it from there — but the URL is the source of truth and writes into it.
 */

function isSectionId(value: string | null): value is SettingsSectionId {
  return value !== null && SETTINGS_SECTIONS.some((section) => section.id === value)
}

function SettingsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const setActiveSection = useSettingsStore((state) => state.setActiveSection)
  const setRequestedConnector = useSettingsStore((state) => state.setRequestedConnector)

  const sectionParam = searchParams.get("section")
  const activeSection: SettingsSectionId = isSectionId(sectionParam)
    ? sectionParam
    : DEFAULT_SECTION_ID

  // Keep the store in step with the URL. Settings sections read the active
  // section from the store, so this is what lets them stay unchanged.
  useEffect(() => {
    setActiveSection(activeSection)
  }, [activeSection, setActiveSection])

  // A connector deep-link is a one-shot instruction; the Integrations section
  // consumes and clears it.
  const connectorParam = searchParams.get("connector")
  useEffect(() => {
    if (connectorParam && isConnectorId(connectorParam)) {
      setRequestedConnector(connectorParam)
    }
  }, [connectorParam, setRequestedConnector])

  const handleSectionChange = useCallback(
    (sectionId: SettingsSectionId) => {
      // replace, not push: moving around the settings rail should not build up
      // history the back button has to walk through to leave settings.
      router.replace(`/settings?section=${encodeURIComponent(sectionId)}`, { scroll: false })
    },
    [router],
  )

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <Breadcrumbs />
        <h1 className="settings-page-title">Settings</h1>
        <p className="settings-page-subtitle">
          Administration Center — configure connections, migration behaviour and platform defaults.
        </p>
      </div>

      <div className="settings-page-body">
        <SettingsLayout activeSection={activeSection} onSectionChange={handleSectionChange} />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="settings-layout-centered">
          <Spinner size="large" label="Loading settings…" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  )
}
