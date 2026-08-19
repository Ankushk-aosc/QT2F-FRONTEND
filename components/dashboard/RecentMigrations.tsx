"use client"

import React from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"

import { DataTable, type DataTableColumn } from "@/components/common/DataTable"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EM_DASH, formatDateTime, orDash } from "@/lib/display"
import type { RunHistoryItem } from "@/stores/runHistory.store"

interface RecentMigrationsProps {
  runs: RunHistoryItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
}

/** Muted em dash for the fields this backend does not report per run. */
function Absent() {
  return <span className="dt-absent">{EM_DASH}</span>
}

/**
 * The dashboard's "Recent Migration Runs" table — a thin read of the same run
 * history the Run History page shows.
 *
 * Source, Destination, Type and Duration are shown because the layout calls for
 * them, but the run records carry no source platform, no destination and no
 * run-level duration, so they render as an em dash until the backend supplies
 * them. `execution_level` is the one type signal that exists and is only ever
 * "partial".
 */
export function RecentMigrations({ runs, loading, error, onRetry }: RecentMigrationsProps) {
  const columns: ReadonlyArray<DataTableColumn<RunHistoryItem>> = [
    {
      key: "run_id",
      header: "Run ID",
      render: (run) => (
        <Link href="/run-history" className="dt-link">
          {orDash(run.run_no || run.run_id)}
        </Link>
      ),
    },
    { key: "source", header: "Source", render: () => <Absent /> },
    { key: "destination", header: "Destination", render: () => <Absent /> },
    {
      key: "type",
      header: "Type",
      render: (run) =>
        run.execution_level ? (
          <span className="dt-capitalize">{run.execution_level}</span>
        ) : (
          <Absent />
        ),
    },
    {
      key: "started",
      header: "Started",
      render: (run) => {
        const started = formatDateTime(run.created_at)
        return started === EM_DASH ? <Absent /> : <span className="dt-muted">{started}</span>
      },
    },
    { key: "duration", header: "Duration", render: () => <Absent /> },
    {
      key: "status",
      header: "Status",
      render: (run) => <StatusBadge status={run.overall_status} />,
    },
  ]

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <DataTable
        columns={columns}
        rows={runs}
        rowKey={(run) => run.run_id}
        loading={loading}
        error={error}
        onRetry={onRetry}
        loadingLabel="Loading recent migrations…"
        errorDescription="Unable to load recent migrations."
        emptyTitle="No migrations yet."
        emptyDescription="Start your first migration from Qlik or Tableau below."
        minWidth={640}
      />
    </Card>
  )
}
