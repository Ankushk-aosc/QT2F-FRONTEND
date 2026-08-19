"use client"

import React from "react"

import { LoadingState } from "@/components/common/LoadingState"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"

export interface DataTableColumn<Row> {
  key: string
  header: string
  align?: "left" | "center" | "right"
  /** Any CSS width — used to keep columns stable across pages. */
  width?: string
  /** Renders the cell. Falls back to `String(row[key])` when omitted. */
  render?: (row: Row) => React.ReactNode
}

interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>
  rows: ReadonlyArray<Row>
  rowKey: (row: Row) => string
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  loadingLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  errorDescription?: string
  /** Below this width the table scrolls horizontally rather than crushing columns. */
  minWidth?: number
  /** Optional leading cell (expand chevron, checkbox) rendered before the first column. */
  renderLeading?: (row: Row) => React.ReactNode
  /** Optional expanded panel rendered as a full-width row beneath `row`. */
  renderExpanded?: (row: Row) => React.ReactNode
}

/**
 * The application's one table.
 *
 * Every screen that lists records shares this so header weight, row height,
 * borders and the loading / empty / error states stay identical. It owns
 * presentation only — sorting, filtering and pagination stay with the caller's
 * store, because those are already implemented there.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  loadingLabel = "Loading…",
  emptyTitle = "Nothing to show yet.",
  emptyDescription,
  errorDescription = "Unable to load this list.",
  minWidth = 720,
  renderLeading,
  renderExpanded,
}: DataTableProps<Row>) {
  if (loading) return <LoadingState label={loadingLabel} />
  if (error) return <ErrorState description={errorDescription} onRetry={onRetry} />
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />

  return (
    <div className="dt-scroll">
      <table className="dt-table" style={{ minWidth: `${minWidth}px` }}>
        <thead>
          <tr>
            {renderLeading && <th className="dt-th dt-th-leading" aria-label="Expand" />}
            {columns.map((column) => (
              <th
                key={column.key}
                className="dt-th"
                style={{ textAlign: column.align ?? "left", width: column.width }}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const expanded = renderExpanded?.(row)
            return (
              <React.Fragment key={key}>
                <tr className="dt-tr">
                  {renderLeading && <td className="dt-td dt-td-leading">{renderLeading(row)}</td>}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="dt-td"
                      style={{ textAlign: column.align ?? "left" }}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
                {expanded && (
                  <tr className="dt-tr-expanded">
                    <td className="dt-td-expanded" colSpan={columns.length + (renderLeading ? 1 : 0)}>
                      {expanded}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
