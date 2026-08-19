"use client"

import React, { Suspense, useEffect, useRef, useState } from "react"
import { PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip } from "@/components/ui/tooltip"

import { MigrationTab } from "@/components/tabs/MigrationTab"
import { MonitoringTab } from "@/components/tabs/MonitoringTab"
import { RunHistoryTab } from "@/components/tabs/RunHistoryTab"
import { QlikMigrationTab } from "@/components/qlik/QlikMigrationTab"
import { QlikMonitoringTab } from "@/components/qlik/QlikMonitoringTab"
import { QlikRunHistoryTab } from "@/components/qlik/QlikRunHistoryTab"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Breadcrumbs } from "@/components/layout/Breadcrumbs"
import { MigrationTabSkeleton, RowSkeleton } from "@/components/ui/Skeletons"
import { useUIStore } from "@/stores/ui.store"
import { useAgentStore } from "@/stores/agent.store"
import type { WorkspaceKind } from "@/types/settings"

export type WorkspaceTab = "Migration" | "Monitoring" | "History"

interface MigrationWorkspaceProps {
  /** Which tab the workspace opens on. */
  activeTab: WorkspaceTab
  /**
   * Pins the workspace to Qlik or Tableau for this route (`/migrations/qlik`,
   * `/migrations/tableau`).
   */
  forcedWorkspace?: WorkspaceKind
}

/**
 * The detailed Migration / Monitoring / Run History workspace for one source.
 *
 * This is the pre-existing tabbed dashboard, mounted at
 * `/migrations/{qlik,tableau}`. Its tabs switch in place: `/monitoring` and
 * `/run-history` are now their own overview pages, so navigating there on a tab
 * click would strand this workspace's detailed views — run selection, workbook
 * drill-down, log dialogs and stop-run. The selected tab is mirrored into
 * `ui.store`, which the tab content already reads.
 */
export function MigrationWorkspace({ activeTab, forcedWorkspace }: MigrationWorkspaceProps) {
  const {
    setActiveTab,
    isSidebarOpen,
    setSidebarOpen,
    fetchInteractiveStatus,
    fetchDataLayerStatus,
    workspace,
    setWorkspace,
  } = useUIStore()

  // The workspace tabs switch in place rather than navigating. `/monitoring`
  // and `/run-history` are now their own overview pages, so routing there would
  // make this workspace's detailed monitoring and history views — with their
  // run selection, workbook drill-down and log dialogs — unreachable.
  const [currentTab, setCurrentTab] = useState<WorkspaceTab>(activeTab)
  const [visitedTabs, setVisitedTabs] = useState<Set<WorkspaceTab>>(() => new Set([activeTab]))

  const hasInitRef = useRef(false)

  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true
    fetchInteractiveStatus()
    fetchDataLayerStatus()
  }, [fetchInteractiveStatus, fetchDataLayerStatus])

  useEffect(() => {
    if (forcedWorkspace && workspace !== forcedWorkspace) {
      setWorkspace(forcedWorkspace)
    }
  }, [forcedWorkspace, workspace, setWorkspace])

  useEffect(() => {
    setCurrentTab(activeTab)
    setVisitedTabs((prev) => new Set(prev).add(activeTab))
  }, [activeTab])

  // The tab content reads the active tab from `ui.store`, so keep it in step.
  useEffect(() => {
    setActiveTab(currentTab)
  }, [currentTab, setActiveTab])

  useEffect(() => {
    return () => {
      useAgentStore.getState().stopPolling()
    }
  }, [])

  const goToTab = (tab: WorkspaceTab) => {
    if (tab === currentTab) return
    setVisitedTabs((prev) => new Set(prev).add(tab))
    setCurrentTab(tab)
  }

  return (
    <div className="workspace-container">
      <div className="workspace-breadcrumb-row">
        <Breadcrumbs />
      </div>
      <div className="workspace-tabs-wrapper">
        {!isSidebarOpen && (
          <Tooltip content="Expand">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="workspace-mobile-trigger"
              aria-label="Expand Sidebar"
            >
              <PanelLeftOpen size={20} />
            </Button>
          </Tooltip>
        )}
        <Tabs value={currentTab} onValueChange={(value: string) => goToTab(value as WorkspaceTab)}>
          <TabsList className="workspace-tablist">
            <TabsTrigger value="Migration">Migration</TabsTrigger>
            <TabsTrigger value="Monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="History">Run History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="workspace-content">
        {workspace === "qlik" ? (
          <>
            {visitedTabs.has("Migration") && (
              <div style={{ display: currentTab === "Migration" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <QlikMigrationTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {visitedTabs.has("Monitoring") && (
              <div style={{ display: currentTab === "Monitoring" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <QlikMonitoringTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {visitedTabs.has("History") && (
              <div style={{ display: currentTab === "History" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<RowSkeleton count={6} />}>
                    <QlikRunHistoryTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </>
        ) : (
          <>
            {visitedTabs.has("Migration") && (
              <div style={{ display: currentTab === "Migration" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <MigrationTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {visitedTabs.has("Monitoring") && (
              <div style={{ display: currentTab === "Monitoring" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <MonitoringTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {visitedTabs.has("History") && (
              <div style={{ display: currentTab === "History" ? "block" : "none", height: "100%" }}>
                <ErrorBoundary>
                  <Suspense fallback={<RowSkeleton count={6} />}>
                    <RunHistoryTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

