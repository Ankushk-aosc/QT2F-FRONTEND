"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, RefreshCw } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useMonitoringStore } from "@/stores/monitoring.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { ChartCard } from "@/components/common/ChartCard"
import { AgentStatusCard } from "@/components/common/AgentStatusCard"
import { MigrationContextBar } from "@/components/common/MigrationContextBar"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { ResourceDonut } from "@/components/common/ResourceDonut"
import { EM_DASH, formatDateTime, formatDuration, orDash } from "@/lib/display"

const AUTO_REFRESH_MS = 15000

/** Muted em dash for values this backend does not report. */
function Absent() {
  return <span className="dt-absent">{EM_DASH}</span>
}

/** One labelled figure in the active-run stat strip. */
function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" | "danger" }) {
  const className = tone ? `run-stat-value run-stat-value-${tone}` : "run-stat-value"
  return (
    <div className="run-stat">
      <span className="run-stat-label">{label}</span>
      <span className={className}>{value}</span>
    </div>
  )
}

/**
 * `/monitoring` — the operations overview.
 *
 * Reads the existing monitoring and dashboard stores; it starts no migration
 * and changes no run. The detailed per-workbook monitoring view, with its run
 * selection and log dialogs, still lives in the migration workspace at
 * `/migrations/{qlik,tableau}`.
 *
 * Progress percentage, estimated time remaining, throughput and the
 * per-resource-type breakdown are not reported by this backend, so they render
 * as unavailable rather than being computed from assumptions.
 */
export function MonitoringOverview() {
  const { user } = useAuth()
  const email = user?.email

  const activeRuns = useMonitoringStore((s) => s.activeRuns)
  const loadingActiveRuns = useMonitoringStore((s) => s.loadingActiveRuns)
  const fetchActiveRuns = useMonitoringStore((s) => s.fetchActiveRuns)
  const historicalRuns = useMonitoringStore((s) => s.historicalRuns)
  const loadingRuns = useMonitoringStore((s) => s.loadingRuns)
  const fetchHistoricalRuns = useMonitoringStore((s) => s.fetchHistoricalRuns)

  const activeRunStats = useDashboardStore((s) => s.activeRunStats)
  const fetchActiveRunStats = useDashboardStore((s) => s.fetchActiveRunStats)

  const [tab, setTab] = useState<"active" | "history">("active")
  const [detailTab, setDetailTab] = useState<"progress" | "resources" | "logs" | "configuration">("progress")
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!email) return
    await Promise.all([fetchActiveRuns(email), fetchHistoricalRuns(undefined, email, { page: 1, pageSize: 10 })])
  }, [email, fetchActiveRuns, fetchHistoricalRuns])

  useEffect(() => {
    load()
  }, [load])

  // Auto refresh re-runs the same fetches the Refresh button does; it does not
  // touch the migration pipeline's own polling.
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => void loadRef.current(), AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [autoRefresh])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const activeRun = activeRuns?.[0]
  const activeRunId: string | undefined = activeRun?.run_id

  // Resource totals live on a per-run endpoint, so they only arrive once we
  // know which run is active. Without this the stat strip would show an em dash
  // for figures the backend can actually supply.
  useEffect(() => {
    if (activeRunId && email) void fetchActiveRunStats(activeRunId, email)
  }, [activeRunId, email, fetchActiveRunStats])

  // Elapsed time is derived from the run's start; the backend reports no
  // elapsed field. Ticks every second while a run is active.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!activeRunId) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activeRunId])

  const startedAt = activeRun?.created_at ?? activeRun?.timestamp
  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return undefined
    const started = new Date(startedAt).getTime()
    if (Number.isNaN(started)) return undefined
    return Math.max(0, (now - started) / 1000)
  }, [startedAt, now])

  // The donut plots only figures the run actually reported.
  const resourceSlices = useMemo(() => {
    if (!activeRunStats) return []
    const successful =
      activeRunStats.total_generation_completed ?? activeRunStats.total_migrated ?? 0
    const failed = activeRunStats.total_failed ?? 0
    const cancelled = activeRunStats.total_cancelled ?? 0
    const total = activeRunStats.total_workbooks ?? 0
    const remaining = Math.max(0, total - successful - failed - cancelled)
    return [
      { name: "Successful", value: successful, color: "var(--success)" },
      { name: "Failed", value: failed, color: "var(--danger)" },
      { name: "Cancelled", value: cancelled, color: "var(--warning)" },
      { name: "Remaining", value: remaining, color: "var(--border-strong)" },
    ].filter((slice) => slice.value > 0)
  }, [activeRunStats])

  const historyColumns: ReadonlyArray<DataTableColumn<any>> = useMemo(
    () => [
      { key: "run_id", header: "Run ID", render: (r) => <span className="dt-link">{orDash(r.run_id)}</span> },
      { key: "source", header: "Source", render: () => <Absent /> },
      { key: "destination", header: "Destination", render: () => <Absent /> },
      {
        key: "started",
        header: "Started",
        render: (r) => {
          const v = formatDateTime(r.created_at ?? r.timestamp)
          return v === EM_DASH ? <Absent /> : <span className="dt-muted">{v}</span>
        },
      },
      { key: "duration", header: "Duration", render: () => <Absent /> },
      {
        key: "status",
        header: "Status",
        render: (r) => <StatusBadge status={r.status ?? r.overall_status} />,
      },
    ],
    [],
  )

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Monitoring</h1>
          <p className="page-subtitle">Real-time overview of all migration activities and system health.</p>
        </div>
        <div className="page-head-actions">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
            Refresh
          </Button>
          <label className="auto-refresh">
            <span>Auto refresh</span>
            <Switch checked={autoRefresh} onChange={setAutoRefresh} aria-label="Auto refresh" />
          </label>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: string) => setTab(v as "active" | "history")}>
        <TabsList className="page-tablist">
          <TabsTrigger value="active">Active Run</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "active" ? (
        <>
          <div className="monitoring-split">
            <Card className="run-card">
              {loadingActiveRuns && !activeRun ? (
                <EmptyState title="Checking for active runs…" />
              ) : !activeRun ? (
                <EmptyState
                  title="No active migration run"
                  description="Start a migration from the Migrations page to monitor it here."
                />
              ) : (
                <>
                  <div className="run-card-head">
                    <span className="run-card-title">Active Migration Run</span>
                    <StatusBadge status={activeRun.status ?? activeRun.overall_status} />
                  </div>
                  <span className="run-card-id">{orDash(activeRun.run_id)}</span>

                  <div className="run-route">
                    <div className="run-route-node">
                      <span className="run-route-label">Source</span>
                      <span className="run-route-value">
                        <Absent />
                      </span>
                    </div>
                    <ArrowRight size={16} className="run-route-arrow" aria-hidden="true" />
                    <div className="run-route-node">
                      <span className="run-route-label">Destination</span>
                      <span className="run-route-value">
                        <Absent />
                      </span>
                    </div>
                    <div className="run-progress">
                      <span className="run-route-label">Overall Progress</span>
                      <span className="run-progress-value">Not reported</span>
                    </div>
                  </div>

                  <div className="run-stats">
                    <Stat label="Started" value={formatDateTime(startedAt)} />
                    <Stat
                      label="Elapsed Time"
                      value={elapsedSeconds === undefined ? <Absent /> : formatDuration(elapsedSeconds)}
                    />
                    <Stat label="Estimated Time Left" value={<Absent />} />
                    <Stat label="Total Resources" value={orDash(activeRunStats?.total_workbooks)} />
                    <Stat
                      label="Processed"
                      value={orDash(activeRunStats?.total_migrated ?? activeRunStats?.total_generation_completed)}
                    />
                    <Stat
                      label="Successful"
                      value={orDash(activeRunStats?.total_generation_completed ?? activeRunStats?.total_migrated)}
                      tone="success"
                    />
                    <Stat label="Failed" value={orDash(activeRunStats?.total_failed)} tone="danger" />
                    <Stat label="Speed" value={<Absent />} />
                  </div>
                </>
              )}
            </Card>

            <AgentStatusCard />
          </div>

          <Tabs value={detailTab} onValueChange={(v: string) => setDetailTab(v as typeof detailTab)}>
            <TabsList className="page-tablist">
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="resources">Resource Summary</TabsTrigger>
              <TabsTrigger value="logs">Recent Logs</TabsTrigger>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
            </TabsList>
          </Tabs>

          {detailTab === "progress" && (
            <div className="dashboard-triple">
              <ChartCard
                title="Progress by Resource Type"
                empty
                emptyMessage="No resource-type breakdown available"
              />
              <ChartCard
                title="Resource Summary"
                empty={resourceSlices.length === 0}
                emptyMessage="No resource data available"
              >
                <ResourceDonut slices={resourceSlices} total={activeRunStats?.total_workbooks ?? 0} />
              </ChartCard>
              <ChartCard title="Recent Logs" empty emptyMessage="No logs available for this run" />
            </div>
          )}
          {detailTab === "resources" && (
            <ChartCard
              title="Resource Summary"
              empty={resourceSlices.length === 0}
              emptyMessage="No resource data available"
              bodyMinHeight={240}
            >
              <ResourceDonut slices={resourceSlices} total={activeRunStats?.total_workbooks ?? 0} />
            </ChartCard>
          )}
          {detailTab === "logs" && (
            <ChartCard title="Recent Logs" empty emptyMessage="No logs available for this run" />
          )}
          {detailTab === "configuration" && (
            <ChartCard title="Configuration" empty emptyMessage="No run configuration available" />
          )}
        </>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <DataTable
            columns={historyColumns}
            rows={historicalRuns ?? []}
            rowKey={(r) => String(r.run_id ?? Math.random())}
            loading={loadingRuns}
            loadingLabel="Loading run history…"
            emptyTitle="No migration history is available."
            emptyDescription="Completed runs will appear here."
            minWidth={720}
          />
        </Card>
      )}

      <MigrationContextBar />
    </div>
  )
}
