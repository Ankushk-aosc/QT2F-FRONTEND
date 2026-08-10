"use client"

import React, { Suspense } from "react"
import { MigrationTab } from "@/components/tabs/MigrationTab"
import { MonitoringTab } from "@/components/tabs/MonitoringTab"
import { RunHistoryTab } from "@/components/tabs/RunHistoryTab"
import { QlikMigrationTab } from "@/components/qlik/QlikMigrationTab"
import { QlikMonitoringTab } from "@/components/qlik/QlikMonitoringTab"
import { QlikRunHistoryTab } from "@/components/qlik/QlikRunHistoryTab"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MigrationTabSkeleton, RowSkeleton } from "@/components/ui/Skeletons"
import { useUIStore } from "@/stores/ui.store"
import {
  Tab,
  TabList,
  Button,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens,
  Tooltip,
} from "@fluentui/react-components"
import {
  PanelLeftExpand24Regular,
} from "@fluentui/react-icons"
import { useEffect, useRef } from "react"
import { recordsService } from "@/services/records.service"
import { useAgentStore } from "@/stores/agent.store"


const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "var(--background)",
  },

  tabsWrapper: {
    backgroundColor: "#eaf4ff",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    margin: "16px 16px 8px 16px",
    padding: "6px 12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: tokens.shadow2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    flexWrap: "wrap",
    position: "relative",
    "@media (max-width: 768px)": {
      margin: "8px 8px 4px 8px",
      padding: "8px",
    },
  },

  tabList: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    maxWidth: "520px",
    flexWrap: "wrap",
  },

  tabBase: {
    // We let Fluent UI keep its internal centering logic (no 'all: unset')
    boxSizing: "border-box",
    height: "32px",
    minWidth: "fit-content",
    
    // Apply perfectly symmetrical padding
    paddingTop: "0",
    paddingBottom: "0",
    paddingLeft: "16px", 
    paddingRight: "16px",
    
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground1,
    backgroundColor: "transparent",
    
    ...shorthands.borderRadius("8px"),
    ...shorthands.border("1px", "solid", "transparent"),
    
    cursor: "pointer",
    transition: `background-color ${tokens.durationNormal}, box-shadow ${tokens.durationNormal}, border-color ${tokens.durationNormal}`,

    // Cleanly hide the default Fluent UI bottom indicator line
    "& .fui-Tab__indicator": {
      display: "none",
    },

    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
      boxShadow: tokens.shadow2,
    },
  },

  selectedTab: {
    fontWeight: tokens.fontWeightSemibold,
    boxShadow: tokens.shadow4, 
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1), 
    
    ":hover": {
      // Prevent the gray hover effect from covering the white active tab
      backgroundColor: tokens.colorNeutralBackground1,
    }
  },

  content: {
    flex: 1,
    overflowY: "auto",
    padding: "0 16px 24px 16px",
    "@media (max-width: 768px)": {
      padding: "0 8px 16px 8px",
    },
  },

  mobileTrigger: {
    display: "none",
    "@media (max-width: 767px)": {
      display: "inline-flex",
      position: "absolute",
      left: "8px",
    },
  },
})

export default function DashboardPage() {
  const styles = useStyles()
  const { activeTab, setActiveTab, isSidebarOpen, setSidebarOpen, fetchInteractiveStatus, fetchDataLayerStatus, workspace } = useUIStore()

  const hasInitRef = useRef(false)

  // Sync both toggles from backend on every page load / refresh
  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true

    console.log("[Dashboard] Syncing settings from backend on mount...")
    
    fetchInteractiveStatus()
    fetchDataLayerStatus()
  }, [fetchInteractiveStatus, fetchDataLayerStatus])

  // Stop polling when navigating away from the dashboard entirely
  useEffect(() => {
    return () => {
      useAgentStore.getState().stopPolling()
    }
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.tabsWrapper}>
        {!isSidebarOpen && (
          <Tooltip content="Expand" relationship="label">
            <Button
              appearance="subtle"
              icon={<PanelLeftExpand24Regular />}
              onClick={() => setSidebarOpen(true)}
              className={styles.mobileTrigger}
              aria-label="Expand Sidebar"
            />
          </Tooltip>
        )}
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, data) => setActiveTab(data.value as any)}
          className={styles.tabList}
          appearance="subtle"
        >
          <Tab
            value="Migration"
            className={mergeClasses(
              styles.tabBase,
              activeTab === "Migration" && styles.selectedTab
            )}
          >
            Migration
          </Tab>

          <Tab
            value="Monitoring"
            className={mergeClasses(
              styles.tabBase,
              activeTab === "Monitoring" && styles.selectedTab
            )}
          >
            Monitoring
          </Tab>

          <Tab
            value="History"
            className={mergeClasses(
              styles.tabBase,
              activeTab === "History" && styles.selectedTab
            )}
          >
            Run History
          </Tab>
        </TabList>
      </div>

      <div className={styles.content}>
        {workspace === "qlik" ? (
          <>
            <div style={{ display: activeTab === "Migration" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<MigrationTabSkeleton />}>
                  <QlikMigrationTab />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "Monitoring" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<MigrationTabSkeleton />}>
                  <QlikMonitoringTab />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "History" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<RowSkeleton count={6} />}>
                  <QlikRunHistoryTab />
                </Suspense>
              </ErrorBoundary>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: activeTab === "Migration" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<MigrationTabSkeleton />}>
                  <MigrationTab />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "Monitoring" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<MigrationTabSkeleton />}>
                  <MonitoringTab />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "History" ? "block" : "none", height: "100%" }}>
              <ErrorBoundary>
                <Suspense fallback={<RowSkeleton count={6} />}>
                  <RunHistoryTab />
                </Suspense>
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  )
}