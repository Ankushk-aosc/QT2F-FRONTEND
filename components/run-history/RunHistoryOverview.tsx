"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { useRunHistoryStore, type RunHistoryItem } from "@/stores/runHistory.store"
import { monitoringService, type MonitoringSummary } from "@/services/monitoring.service"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { RunDetailsModal } from "@/components/modals/RunDetailsModal"
import { EM_DASH, formatDateTime, orDash } from "@/lib/display"

const PAGE_SIZES = [10, 25, 50]

/** Filter controls size to their content rather than filling the bar. */
const FILTER_SELECT_STYLE = { width: "auto", minWidth: "150px" } as const

/** Muted em dash for values this backend does not report per run. */
function Absent() {
  return <span className="dt-absent">{EM_DASH}</span>
}

/**
 * `/run-history` — every past run, with the filters and pagination the existing
 * store already supports.
 *
 * Search, Status and Time range are wired to `fetchRunHistory`'s filter options.
 * Source and Type have no per-run field behind them, so their controls are
 * present but disabled and say why, rather than appearing to filter and then
 * doing nothing.
 */
export function RunHistoryOverview() {
  const { user } = useAuth()
  const email = user?.email

  const runHistory = useRunHistoryStore((s) => s.runHistory)
  const pagination = useRunHistoryStore((s) => s.pagination)
  const isLoading = useRunHistoryStore((s) => s.isLoading)
  const error = useRunHistoryStore((s) => s.error)
  const fetchRunHistory = useRunHistoryStore((s) => s.fetchRunHistory)

  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("All")
  const [timeframe, setTimeframe] = useState("All")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detailRun, setDetailRun] = useState<RunHistoryItem | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [summary, setSummary] = useState<MonitoringSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryFailed, setSummaryFailed] = useState(false)

  const load = useCallback(async () => {
    if (!email) return
    await fetchRunHistory(email, {
      page,
      pageSize,
      filters: {
        search: search.trim() || undefined,
        status: status === "All" ? undefined : status,
        timeframe,
      },
    })
  }, [email, fetchRunHistory, page, pageSize, search, status, timeframe])

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => void load(), 300)
    return () => clearTimeout(id)
  }, [load])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!email) return
      setSummaryLoading(true)
      setSummaryFailed(false)
      try {
        const data = await monitoringService.fetchMonitoringSummary(email)
        if (!cancelled) setSummary(data)
      } catch {
        if (!cancelled) setSummaryFailed(true)
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [email])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const metric = (value: number | undefined) => {
    if (summaryLoading) return "…"
    if (summaryFailed || value === undefined) return EM_DASH
    return value
  }

  const columns: ReadonlyArray<DataTableColumn<RunHistoryItem>> = useMemo(
    () => [
      {
        key: "run_id",
        header: "Run ID",
        render: (run) => (
          <button type="button" className="dt-link dt-link-button" onClick={() => setDetailRun(run)}>
            {orDash(run.run_no || run.run_id)}
          </button>
        ),
      },
      {
        key: "application",
        header: "Application",
        render: (run) => (
          <span className="dt-primary-text font-medium">
            {orDash(run.workbook_name || run.project_name || (run.processed_items?.[0]?.app_name) || (run.processed_items?.[0]?.workbook_name))}
          </span>
        ),
      },
      { key: "source", header: "Source", render: () => <Absent /> },
      { key: "destination", header: "Destination", render: () => <Absent /> },
      {
        key: "type",
        header: "Type",
        render: (run) =>
          run.execution_level ? <span className="dt-capitalize">{run.execution_level}</span> : <Absent />,
      },
      {
        key: "started",
        header: "Started",
        render: (run) => {
          const v = formatDateTime(run.created_at)
          return v === EM_DASH ? <Absent /> : <span className="dt-muted">{v}</span>
        },
      },
      { key: "duration", header: "Duration", render: () => <Absent /> },
      {
        key: "resources",
        header: "Resources",
        align: "right",
        render: (run) =>
          Array.isArray(run.processed_items) && run.processed_items.length > 0 ? (
            <span>{run.processed_items.length}</span>
          ) : (
            <Absent />
          ),
      },
      { key: "successful", header: "Successful", align: "right", render: () => <Absent /> },
      { key: "failed", header: "Failed", align: "right", render: () => <Absent /> },
      {
        key: "status",
        header: "Status",
        render: (run) => <StatusBadge status={run.overall_status} />,
      },
      {
        key: "actions",
        header: "Actions",
        align: "center",
        render: (run) => (
          <Tooltip content="View run details">
            <button
              type="button"
              className="dt-icon-button"
              aria-label={`View details for run ${run.run_no || run.run_id}`}
              onClick={() => setDetailRun(run)}
            >
              <Eye size={16} />
            </button>
          </Tooltip>
        ),
      },
    ],
    [],
  )

  const total = pagination?.total ?? 0
  const totalPages = Math.max(1, pagination?.totalPages ?? 1)
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total || runHistory.length)

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1 className="page-title">Run History</h1>
          <p className="page-subtitle">View and search through all your past migration runs.</p>
        </div>
        <div className="page-head-actions">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="runhistory-metrics">
        <MetricCard label="Total Runs" value={metric(summary?.total_runs)} icon={<Database size={18} />} />
        <MetricCard
          label="Completed"
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
        <MetricCard label="Cancelled" value={EM_DASH} icon={<Ban size={18} />} hint="Not reported" />
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" aria-hidden="true" />
          <Input
            placeholder="Search by Run ID or number…"
            aria-label="Search runs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <Tooltip content="Runs do not record a source platform">
          <span className="filter-disabled-wrap">
            <Select value="All" disabled aria-label="All Sources" style={FILTER_SELECT_STYLE}>
              <SelectItem value="All">All Sources</SelectItem>
            </Select>
          </span>
        </Tooltip>

        <Select
          value={status}
          aria-label="All Statuses"
          style={FILTER_SELECT_STYLE}
          onValueChange={(value: string) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectItem value="All">All Statuses</SelectItem>
          <SelectItem value="Extraction Completed">Extraction Completed</SelectItem>
          <SelectItem value="Validation Pending">Validation Pending</SelectItem>
          <SelectItem value="Migration Completed">Migration Completed</SelectItem>
          <SelectItem value="Failed">Failed</SelectItem>
        </Select>

        <Tooltip content="Runs do not record a migration type">
          <span className="filter-disabled-wrap">
            <Select value="All" disabled aria-label="All Types" style={FILTER_SELECT_STYLE}>
              <SelectItem value="All">All Types</SelectItem>
            </Select>
          </span>
        </Tooltip>

        <Select
          value={timeframe}
          aria-label="Time range"
          style={FILTER_SELECT_STYLE}
          onValueChange={(value: string) => {
            setTimeframe(value)
            setPage(1)
          }}
        >
          <SelectItem value="All">All Time</SelectItem>
          <SelectItem value="Today">Today</SelectItem>
          <SelectItem value="Yesterday">Yesterday</SelectItem>
          <SelectItem value="This Week">This Week</SelectItem>
        </Select>

        <Tooltip content="No additional filters are available">
          <span className="filter-disabled-wrap">
            <Button variant="outline" disabled>
              <SlidersHorizontal size={16} />
              Filters
            </Button>
          </span>
        </Tooltip>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <DataTable
          columns={columns}
          rows={runHistory}
          rowKey={(run) => run.run_id}
          loading={isLoading && runHistory.length === 0}
          error={error}
          onRetry={load}
          loadingLabel="Loading run history…"
          errorDescription="Unable to load run history."
          emptyTitle="No migration history is available."
          emptyDescription="Completed and failed runs will appear here."
          minWidth={1100}
          renderLeading={(run) => (
            <button
              type="button"
              className="dt-expand"
              aria-label={expanded === run.run_id ? "Collapse row" : "Expand row"}
              aria-expanded={expanded === run.run_id}
              onClick={() => setExpanded(expanded === run.run_id ? null : run.run_id)}
            >
              {expanded === run.run_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          renderExpanded={(run) =>
            expanded === run.run_id ? (
              <div className="run-stages">
                {(
                  [
                    ["Assessment", run.assessment_status],
                    ["Parsing", run.parsing_status],
                    ["Data Layer", run.datalayer_status],
                    ["Mapping", run.mapping_status],
                    ["Generation", run.generation_status],
                    ["Validation", run.validation_status],
                  ] as ReadonlyArray<[string, string | undefined]>
                ).map(([label, value]) => (
                  <div key={label} className="run-stage">
                    <span className="run-stat-label">{label}</span>
                    {value ? <StatusBadge status={value} /> : <Absent />}
                  </div>
                ))}
              </div>
            ) : null
          }
        />
      </Card>

      <div className="pagination-bar">
        <label className="pagination-size">
          <span>Rows per page:</span>
          <Select
            value={String(pageSize)}
            aria-label="Rows per page"
            style={{ width: "auto", minWidth: "76px" }}
            onValueChange={(value: string) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          >
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </Select>
        </label>

        <div className="pagination-controls">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="pagination-current">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>

        <span className="pagination-summary">
          {total > 0 ? `Showing ${firstRow} to ${lastRow} of ${total} results` : "No results"}
        </span>
      </div>

      <RunDetailsModal
        isOpen={detailRun !== null}
        onOpenChange={(open) => {
          if (!open) setDetailRun(null)
        }}
        runData={detailRun}
      />
    </div>
  )
}
