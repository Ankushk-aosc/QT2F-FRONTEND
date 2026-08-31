"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Database,
  PlayCircle,
  RefreshCw,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useRunHistoryStore } from "@/stores/runHistory.store"
import { monitoringService, type MonitoringSummary } from "@/services/monitoring.service"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { RecentMigrations } from "@/components/dashboard/RecentMigrations"
import { ChartCard } from "@/components/common/ChartCard"
import { AgentStatusCard } from "@/components/common/AgentStatusCard"
import { MigrationContextBar } from "@/components/common/MigrationContextBar"
import { Button } from "@/components/ui/button"
import { EM_DASH } from "@/lib/display"

/**
 * `/dashboard` — the application's home.
 *
 * An overview, not a second copy of the migration workspace: totals, recent
 * runs, and the breakdown/health cards. Starting a migration or looking at
 * history hands off to `/migrations` and `/run-history` immediately rather than
 * growing this page to hold their content.
 *
 * Several sections here have no backing data in the current backend — the
 * trend series, the source/type breakdowns and the cancelled total. Those keep
 * their card and report that the data is unavailable, rather than being dropped
 * from the layout or filled with placeholder numbers.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const email = user?.email

  const currentPageRunHistory = useRunHistoryStore((s) => s.runHistory)
  const fetchRunHistory = useRunHistoryStore((s) => s.fetchRunHistory)
  const runHistoryError = useRunHistoryStore((s) => s.error)
  const [runsLoading, setRunsLoading] = useState(true)

  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadSummary = React.useCallback(async () => {
    if (!email) return
    setSummaryError(null)
    try {
      const data = await monitoringService.fetchMonitoringSummary(email)
      setSummary(data)
    } catch (err: any) {
      setSummaryError(err?.message || "Failed to load migration summary")
    }
  }, [email])

  const loadRuns = React.useCallback(async () => {
    if (!email) return
    // Smaller than DEFAULT_PAGE_SIZE on purpose: this is the dashboard's
    // "recent runs" preview widget, not the full paged run-history table.
    await fetchRunHistory(email, { page: 1, pageSize: 5 })
  }, [email, fetchRunHistory])

  const loadAll = React.useCallback(async () => {
    setSummaryLoading(true)
    setRunsLoading(true)
    await Promise.all([loadSummary(), loadRuns()])
    setSummaryLoading(false)
    setRunsLoading(false)
    setLastUpdated(new Date())
  }, [loadSummary, loadRuns])

  useEffect(() => {
    loadAll()
    // Only on mount / when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  const recentRuns = currentPageRunHistory.slice(0, 5)

  // `—` while loading or on failure; a real number only when one arrived.
  const metric = (value: number | undefined) => {
    if (summaryLoading) return "…"
    if (summaryError || value === undefined) return EM_DASH
    return value
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-text">
          <h1 className="dashboard-title">
            Welcome back{user?.name ? `, ${user.name}` : ""} <span aria-hidden="true">👋</span>
          </h1>
          <p className="dashboard-subtitle">
            Here&apos;s what&apos;s happening with your migrations today.
          </p>
        </div>
        <div className="dashboard-welcome-actions">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
            Refresh Data
          </Button>
          <span className="dashboard-last-updated">
            {lastUpdated
              ? `Last updated: ${lastUpdated.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Not yet updated"}
          </span>
        </div>
      </div>

      <section className="dashboard-section">
        <span className="dashboard-section-title">Migration Overview</span>
        <div className="dashboard-metrics-row">
          <MetricCard
            label="Total Migrations"
            value={metric(summary?.total_runs)}
            icon={<Database size={18} />}
            hint={summaryError ? "Totals unavailable" : undefined}
          />
          <MetricCard
            label="Running"
            value={metric(summary?.in_progress)}
            icon={<PlayCircle size={18} />}
            tone="info"
            hint="In progress"
          />
          <MetricCard
            label="Successful"
            value={metric(summary?.completed)}
            icon={<CheckCircle2 size={18} />}
            tone="success"
          />
          <MetricCard
            label="Failed"
            value={metric(summary?.failed)}
            icon={<XCircle size={18} />}
            tone="danger"
          />
          <MetricCard
            label="Cancelled"
            value={EM_DASH}
            icon={<Ban size={18} />}
            hint="Not reported"
          />
        </div>
      </section>

      <div className="dashboard-split">
        <section className="dashboard-section">
          <div className="dashboard-section-head">
            <span className="dashboard-section-title">Recent Migration Runs</span>
            <Link href="/run-history" className="dashboard-view-all">
              View all
            </Link>
          </div>
          <RecentMigrations
            runs={recentRuns}
            loading={runsLoading}
            error={runHistoryError}
            onRetry={loadRuns}
          />
          <div className="dashboard-start-actions">
            <Button as="a" href="/migrations/qlik">
              New Qlik Migration
              <ArrowRight size={16} />
            </Button>
            <Button as="a" href="/migrations/tableau" variant="outline">
              New Tableau Migration
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>

        <ChartCard
          title="Migrations Trend"
          empty
          emptyMessage="No migration data available"
          bodyMinHeight={240}
        >
          {null}
        </ChartCard>
      </div>

      <div className="dashboard-triple">
        <ChartCard title="Migrations by Source" empty emptyMessage="No source data available" />
        <ChartCard title="Migrations by Type" empty emptyMessage="No migration type data available" />
        <AgentStatusCard title="System Status" />
      </div>

      <MigrationContextBar />
    </div>
  )
}
