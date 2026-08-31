"use client"

import React, { useMemo } from "react"
import { useAgentStore } from "@/stores/agent.store"
import {
  Database,
  Folder,
  LayoutGrid,
  SplitSquareHorizontal,
  Receipt,
  Code,
  PieChart,
} from "lucide-react"
import { mapQlikAssessment } from "@/lib/qlikAssessment"
import type { AssessmentData } from "@/types/assessment"

/**
 * Portfolio/multi-app rollup, ported from T2F's `components/tabs/SingleAssessmentCards.tsx`
 * (dead code in this repo, confirmed byte-identical to T2F's styling —
 * `Q2F_T2F_FRONTEND_REPLICATION_PLAN.md` §6 step 5). The card layout below is
 * that file's layout verbatim; only the data feeding it changed:
 *
 *   - Tableau nouns -> Qlik nouns per the plan's §8 glossary: workbook -> app,
 *     project -> space, site -> omitted entirely (no Qlik equivalent).
 *   - Tableau-only concepts with no Qlik analog (Dashboards/Stories/Custom SQL
 *     as Tableau defines them, "Estimated Effort" in minutes) are replaced
 *     with the closest real, computed Qlik field rather than invented or
 *     hardcoded: Sheets (Qlik's dashboard-equivalent canvas), KPIs, Master
 *     Items (master dimensions + measures, the DAX-rewrite candidate list),
 *     Complex Queries (`queryFindings`, Qlik's closest analog to Tableau's
 *     custom-SQL complexity signal), and Migration Challenges identified.
 *
 * Every number here is `mapQlikAssessment(...)` output summed across apps —
 * nothing is invented. See the field-by-field trace in the module's inline
 * comments below.
 */

// Plain style objects in place of Fluent's makeStyles/shorthands/tokens --
// same values, referencing this app's CSS custom properties where Fluent
// used a semantic token.
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    marginBottom: "24px",
  },
  row: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap",
  },
  card: {
    flex: 1,
    minWidth: "350px",
    padding: "20px",
    borderRadius: "12px",
    boxShadow: "var(--shadow-md)",
    border: "1px solid var(--border)",
    backgroundColor: "var(--surface)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "20px",
    fontWeight: 600,
    fontSize: "16px",
  },
  gridCard: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
  },
  metricBox: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    backgroundColor: "var(--surface-subtle)",
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  metricHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  metricValue: {
    fontSize: "40px",
    fontWeight: 700,
    color: "var(--text)",
  },
  loadedNote: {
    marginBottom: "12px",
  },
}

/** The one processed-item shape this component reads; see `runHistoryMapper.ts`. */
interface ProcessedRunItem {
  app_id?: string
  app_name?: string
  space_id?: string
  space_name?: string
  workbook_id?: string
  workspace_id?: string
  [key: string]: unknown
}

interface PortfolioRollupProps {
  /**
   * The mapped run item RunDetailsModal already carries (see
   * `app/Mapper/runHistoryMapper.ts`'s `RunHistoryItem`) — only `run_id` and
   * `processed_items` are read. Typed loosely because callers pass the same
   * loosely-typed `runData` the modal receives.
   */
  runData?: {
    run_id?: string
    processed_items?: ProcessedRunItem[]
    [key: string]: unknown
  } | null
}

/**
 * Renders nothing for a single-app run (or no run) — the per-app tab set
 * already covers that case, and T2F's own rollup only exists to summarise a
 * *portfolio* of apps. Self-gating here means the call site can mount this
 * unconditionally.
 */
export default function PortfolioRollup({ runData }: PortfolioRollupProps) {
  const assessmentData = useAgentStore((state) => state.assessmentData)

  const runId = runData?.run_id || ""
  const processedItems = useMemo(
    () => (Array.isArray(runData?.processed_items) ? (runData!.processed_items as ProcessedRunItem[]) : []),
    [runData],
  )

  const metrics = useMemo(() => {
    const spaceIds = new Set<string>()
    let sheetsTotal = 0
    let kpiTotal = 0
    let masterItemsTotal = 0
    let complexQueriesTotal = 0
    let dataSourcesTotal = 0
    let challengesTotal = 0
    let complexitySum = 0
    let complexityScored = 0
    let appsWithData = 0

    const runAssessments = runId ? assessmentData[runId] : undefined

    for (const item of processedItems) {
      const appId = String(item?.app_id || item?.workbook_id || "")
      const spaceId = String(item?.space_id || item?.workspace_id || "")
      if (spaceId) spaceIds.add(spaceId)

      const raw = appId ? runAssessments?.[appId] : undefined
      // `assessmentData[runId][appId]` is the raw `/api/assessment` response,
      // which wraps the payload AssessmentResultsView/mapQlikAssessment expect
      // under `.payload` — same shape RunDetailsModal reads at
      // `assessmentData[runId]?.[appId]?.payload`.
      const payload = (raw as { payload?: AssessmentData } | undefined)?.payload
      if (!payload) continue

      appsWithData++
      const parsed = mapQlikAssessment(payload)

      sheetsTotal += parsed.totalPages
      kpiTotal += parsed.kpiCount
      masterItemsTotal += parsed.masterDimensionCount + parsed.masterMeasureCount
      complexQueriesTotal += parsed.queryFindings.length
      dataSourcesTotal += parsed.connections.length
      challengesTotal += parsed.challenges.length
      if (parsed.complexityScore !== null) {
        complexitySum += parsed.complexityScore
        complexityScored++
      }
    }

    return {
      spaces: spaceIds.size,
      apps: processedItems.length,
      appsWithData,
      sheets: sheetsTotal,
      kpis: kpiTotal,
      masterItems: masterItemsTotal,
      complexQueries: complexQueriesTotal,
      dataSources: dataSourcesTotal,
      challenges: challengesTotal,
      avgComplexity: complexityScored > 0 ? Math.round(complexitySum / complexityScored) : null,
    }
  }, [processedItems, assessmentData, runId])

  // Single-app (or empty) runs already get the full picture from the per-app
  // tab set below — the rollup only adds value once there is a portfolio to
  // summarise.
  if (metrics.apps <= 1) return null

  return (
    <div style={styles.container}>
      {metrics.appsWithData < metrics.apps && (
        <div style={{ ...styles.loadedNote, color: "var(--text-muted)", fontSize: "12px" }}>
          Aggregated from {metrics.appsWithData} of {metrics.apps} apps with assessment data loaded — open an app below to
          include it here.
        </div>
      )}

      <div style={styles.row}>
        {/* Inventory Overview */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Database />
            Inventory Overview
          </div>
          <div style={styles.gridCard}>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <Folder size={16} /> Spaces
              </div>
              <div style={styles.metricValue}>{metrics.spaces}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <LayoutGrid size={16} /> Apps
              </div>
              <div style={styles.metricValue}>{metrics.apps}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <SplitSquareHorizontal size={16} /> Sheets
              </div>
              <div style={styles.metricValue}>{metrics.sheets}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <Receipt size={16} /> KPIs
              </div>
              <div style={styles.metricValue}>{metrics.kpis}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <PieChart size={16} /> Master Items
              </div>
              <div style={styles.metricValue}>{metrics.masterItems}</div>
            </div>
            <div style={styles.metricBox}>
              <div style={styles.metricHeader}>
                <Code size={16} /> Complex Queries
              </div>
              <div style={styles.metricValue}>{metrics.complexQueries}</div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ ...styles.card, flex: 1.5 }}>
          <div style={styles.cardHeader}>
            Summary Cards
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", height: "100%" }}>
            <div style={{ ...styles.metricBox, justifyContent: "center", alignItems: "center" }}>
              <div style={styles.metricHeader}>Total Apps</div>
              <div style={styles.metricValue}>{metrics.apps}</div>
            </div>
            <div style={{ ...styles.metricBox, justifyContent: "center", alignItems: "center" }}>
              <div style={styles.metricHeader}>Data Sources</div>
              <div style={styles.metricValue}>{metrics.dataSources}</div>
            </div>
            <div style={{ ...styles.metricBox, justifyContent: "center", alignItems: "center" }}>
              <div style={styles.metricHeader}>Migration Challenges</div>
              <div style={{ ...styles.metricValue, color: "var(--primary)" }}>{metrics.challenges}</div>
            </div>
            <div style={{ ...styles.metricBox, justifyContent: "center", alignItems: "center" }}>
              <div style={styles.metricHeader}>Avg Complexity</div>
              <div style={styles.metricValue}>
                {metrics.avgComplexity !== null ? (
                  <>
                    {metrics.avgComplexity} <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/100</span>
                  </>
                ) : (
                  <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { PortfolioRollup }
