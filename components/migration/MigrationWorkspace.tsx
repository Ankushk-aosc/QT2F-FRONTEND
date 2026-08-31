"use client"

import React, { Suspense, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { PanelLeftOpen } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip } from "@/components/ui/tooltip"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Breadcrumbs } from "@/components/layout/Breadcrumbs"
import { MigrationTabSkeleton, RowSkeleton } from "@/components/ui/Skeletons"
import { useUIStore } from "@/stores/ui.store"
import { useAgentStore } from "@/stores/agent.store"
import type { WorkspaceKind } from "@/types/settings"

const MigrationTab = dynamic(
  () => import("@/components/tabs/MigrationTab").then(m => ({ default: m.MigrationTab })),
  { ssr: false, loading: () => <MigrationTabSkeleton /> }
)
const QlikMigrationTab = dynamic(
  () => import("@/components/qlik/QlikMigrationTab").then(m => ({ default: m.QlikMigrationTab })),
  { ssr: false, loading: () => <MigrationTabSkeleton /> }
)

const MonitoringTab = dynamic(() => import("@/components/tabs/MonitoringTab").then(m => ({ default: m.MonitoringTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> });
const RunHistoryTab = dynamic(() => import("@/components/tabs/RunHistoryTab").then(m => ({ default: m.RunHistoryTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> });
const QlikMonitoringTab = dynamic(() => import("@/components/qlik/QlikMonitoringTab").then(m => ({ default: m.QlikMonitoringTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> });
const QlikRunHistoryTab = dynamic(() => import("@/components/qlik/QlikRunHistoryTab").then(m => ({ default: m.QlikRunHistoryTab })), { ssr: false, loading: () => <MigrationTabSkeleton /> });

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

  const [currentTab, setCurrentTab] = useState<WorkspaceTab>(activeTab)
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
  }, [activeTab])

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
            {/* <TabsTrigger value="Monitoring">Monitoring</TabsTrigger> */}
            {/* <TabsTrigger value="History">Run History</TabsTrigger> */}
          </TabsList>
        </Tabs>
      </div>

      <div className="workspace-content">
        {workspace === "qlik" ? (
          <>
            {currentTab === "Migration" && (
              <div className="workspace-tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <QlikMigrationTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {currentTab === "Monitoring" && (
              <div className="workspace-tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <QlikMonitoringTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {currentTab === "History" && (
              <div className="workspace-tab-panel">
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
            {currentTab === "Migration" && (
              <div className="workspace-tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <MigrationTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {currentTab === "Monitoring" && (
              <div className="workspace-tab-panel">
                <ErrorBoundary>
                  <Suspense fallback={<MigrationTabSkeleton />}>
                    <MonitoringTab />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
            {currentTab === "History" && (
              <div className="workspace-tab-panel">
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
