"use client"

import React, { useEffect, useMemo, useState } from "react"
import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  OverlayDrawer,
  SearchBox,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components"
import { Dismiss24Regular, Settings24Regular } from "@fluentui/react-icons"

import {
  SETTINGS_GROUPS,
  searchSections,
  type SettingsSection,
  type SettingsSectionId,
} from "@/lib/settings/navigation"
import { useSettingsStore } from "@/stores/settings.store"
import { useUIStore } from "@/stores/ui.store"

import { SettingsSectionRouter } from "./sections"

const useStyles = makeStyles({
  drawer: {
    width: "min(1120px, 96vw)",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    padding: 0,
    overflow: "hidden",
  },
  layout: {
    display: "flex",
    flex: 1,
    minHeight: 0,
  },
  nav: {
    width: "260px",
    flexShrink: 0,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px 12px",
    overflowY: "auto",
  },
  navGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginBottom: "8px",
  },
  navGroupLabel: {
    padding: "8px 8px 4px",
    color: tokens.colorNeutralForeground3,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    width: "100%",
    textAlign: "left",
    border: "none",
    borderRadius: tokens.borderRadiusMedium,
    padding: "8px 10px",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  navItemActive: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    fontWeight: tokens.fontWeightSemibold,
  },
  navItemPlanned: {
    color: tokens.colorNeutralForeground3,
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "24px 28px 48px",
  },
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "240px",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "20px",
    padding: "8px 28px 0",
    color: tokens.colorNeutralForeground3,
  },
  emptyNav: {
    padding: "12px 10px",
    color: tokens.colorNeutralForeground3,
  },
})

/**
 * The Enterprise Administration Center.
 *
 * Replaces the previous single-column settings drawer with a navigable admin
 * surface: a searchable section rail on the left and the selected section on
 * the right. It reuses the existing `isSettingsOpen` UI state, so the trigger in
 * the top navigation is unchanged.
 */
export function SettingsCenter() {
  const styles = useStyles()

  const isSettingsOpen = useUIStore((state) => state.isSettingsOpen)
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen)

  const activeSection = useSettingsStore((state) => state.activeSection)
  const setActiveSection = useSettingsStore((state) => state.setActiveSection)
  const loadSettings = useSettingsStore((state) => state.loadSettings)
  const loading = useSettingsStore((state) => state.loading)
  const loaded = useSettingsStore((state) => state.loaded)
  const saving = useSettingsStore((state) => state.saving)
  const error = useSettingsStore((state) => state.error)
  const clearError = useSettingsStore((state) => state.clearError)

  const [query, setQuery] = useState("")

  // Load configuration when the centre is opened. `loadSettings` is a no-op if
  // the document is already in memory.
  useEffect(() => {
    if (isSettingsOpen) {
      void loadSettings()
    }
  }, [isSettingsOpen, loadSettings])

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

  const handleSelect = (section: SettingsSection) => {
    setActiveSection(section.id)
  }

  // If a search hides the active section, move to the first visible result so
  // the content pane never shows something the rail no longer offers.
  useEffect(() => {
    if (matches.length > 0 && !matchedIds.has(activeSection)) {
      setActiveSection(matches[0].id as SettingsSectionId)
    }
  }, [matches, matchedIds, activeSection, setActiveSection])

  return (
    <OverlayDrawer
      position="end"
      open={isSettingsOpen}
      onOpenChange={(_, { open }) => setSettingsOpen(open)}
      className={styles.drawer}
      style={{ height: "100vh" }}
    >
      <DrawerHeader className={styles.header}>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close settings"
              icon={<Dismiss24Regular />}
              onClick={() => setSettingsOpen(false)}
            />
          }
        >
          <div className={styles.headerTitle}>
            <Settings24Regular />
            <Text size={500} weight="semibold">
              Administration Center
            </Text>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody className={styles.body}>
        {error ? (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
            <MessageBarActions
              containerAction={
                <Button
                  appearance="transparent"
                  aria-label="Dismiss error"
                  icon={<Dismiss24Regular />}
                  onClick={clearError}
                />
              }
            >
              <Button onClick={() => void loadSettings(true)}>Retry</Button>
            </MessageBarActions>
          </MessageBar>
        ) : null}

        <div className={styles.statusBar}>
          {saving ? (
            <>
              <Spinner size="tiny" />
              <Text size={200}>Saving…</Text>
            </>
          ) : null}
        </div>

        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Settings sections">
            <SearchBox
              placeholder="Search settings"
              value={query}
              onChange={(_, data) => setQuery(data.value)}
              aria-label="Search settings"
            />

            {groups.length === 0 ? (
              <Text size={200} className={styles.emptyNav}>
                No settings match “{query}”.
              </Text>
            ) : (
              groups.map((group) => (
                <div key={group.id} className={styles.navGroup}>
                  <Text size={100} weight="semibold" className={styles.navGroupLabel}>
                    {group.label}
                  </Text>
                  {group.sections.map((section) => {
                    const isActive = section.id === activeSection
                    const isPlanned = section.status === "planned"
                    return (
                      <button
                        key={section.id}
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          styles.navItem,
                          isActive ? styles.navItemActive : "",
                          isPlanned ? styles.navItemPlanned : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => handleSelect(section)}
                      >
                        <span>{section.label}</span>
                        {isPlanned ? (
                          <Badge appearance="outline" size="small" color="informative">
                            Soon
                          </Badge>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </nav>

          <div className={styles.content}>
            {loading && !loaded ? (
              <div className={styles.centered}>
                <Spinner size="large" label="Loading settings…" />
              </div>
            ) : (
              <SettingsSectionRouter sectionId={activeSection} />
            )}
          </div>
        </div>
      </DrawerBody>
    </OverlayDrawer>
  )
}
