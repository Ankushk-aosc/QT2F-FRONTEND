"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  CheckCircle2,
  Database,
  Settings,
  ArrowRight,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import React, { useMemo, useState, useEffect } from 'react'
import { useDatalayerStore } from "@/stores/datalayer.store"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"

/* ── Reusable pagination (Aligned with AssessmentTab) ── */
function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const needsPagination = items.length > pageSize
  const pageItems = needsPagination ? items.slice(page * pageSize, (page + 1) * pageSize) : items
  
  const safePage = Math.min(page, totalPages - 1)
  
  useEffect(() => {
    if (safePage !== page && safePage >= 0) {
      setPage(safePage)
    }
  }, [safePage, page])
  
  return { page, setPage, totalPages, needsPagination, pageItems, total: items.length }
}

function PaginationControls({ page, totalPages, total, setPage, pageSize = 10 }: { page: number; totalPages: number; total: number; setPage: (fn: (p: number) => number) => void; pageSize?: number }) {
  return (
    <div className="vl-flex-col-mobile" style={{ alignItems: "center", gap: "12px", padding: "12px 16px", borderTop: "1px solid #e2e8f0", fontSize: "13px", color: "#64748b" }}>
      <span>Page {page + 1} of {totalPages} ({Math.min((page + 1) * pageSize, total)} of {total} items)</span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 0 ? "#f8fafc" : "#ffffff", color: page === 0 ? "#cbd5e1" : "#334155", cursor: page === 0 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Previous</button>
        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: page >= totalPages - 1 ? "#f8fafc" : "#ffffff", color: page >= totalPages - 1 ? "#cbd5e1" : "#334155", cursor: page >= totalPages - 1 ? "default" : "pointer", fontWeight: 500, fontSize: "13px" }}>Next</button>
      </div>
    </div>
  )
}

/* ── Global Style Tokens (Aligned with globals.css) ── */
const styles = {
  container: "vl-container",
  header: "vl-header",
  title: "vl-title",
  subtitle: "vl-subtitle",
  metricsGrid: "vl-metrics-grid",
  metricCard: "vl-metric-card",
  metricValue: "vl-metric-value",
  metricLabel: "vl-metric-label",
  sectionCard: "vl-section-card",
  sectionHeaderRow: "vl-section-header-row",
  sectionHeader: "vl-section-header",
  grid2: "vl-grid-2",
  infoItem: "vl-info-item",
  infoLabel: "vl-info-label",
  infoValue: "vl-info-value",
  tableContainer: "vl-table-container",
}

interface DataLayerTabProps {
  workbookId: string
  projectId?: string
  runId?: string
}

export function DataLayerTab({ workbookId, projectId: propProjectId, runId: propRunId }: DataLayerTabProps) {
  // Stores
  const { currentRunId, currentProjectId } = useAgentStore()
  const { selectedProject } = useDashboardStore()
  const { datalayerData: storeDataLayerData, fetchDataLayerResult, isLoading, error: storeError } = useDatalayerStore()

  // IDs resolution
  const projectId = propProjectId || currentProjectId || selectedProject || ""
  const runId = propRunId || currentRunId || ""

  // Data fetching
  const datalayerData = storeDataLayerData[workbookId]

  useEffect(() => {
    if (!datalayerData && projectId && workbookId && runId) {
      fetchDataLayerResult(projectId, workbookId, runId);
    }
  }, [datalayerData, projectId, workbookId, runId, fetchDataLayerResult]);


  const [openSections, setOpenSections] = useState({
    techSpec: true
  })

  const [filterLayer, setFilterLayer] = useState<string>("Gold")

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Derive dynamic metrics
  const metrics = useMemo(() => {
    if (!datalayerData) return []
    const goldCount = datalayerData.pipeline_summary?.gold_delta_tables ?? datalayerData.pipeline_summary?.gold_tables_created ?? datalayerData.extract_pipeline?.gold_tables?.length ?? 0;
    
    return [
      { label: "Detected Sources", value: datalayerData.pipeline_summary?.hyper_files_found || 0 },
      { label: "Tables Created (Gold)", value: goldCount },
      { label: "Notebooks", value: datalayerData.notebooks?.count || 0 },
    ]
  }, [datalayerData])

  // Derive dynamic table data from actual backend response
  const tableData = useMemo(() => {
    if (!datalayerData) return []
    const assets: { name: string; layer: string; status: string }[] = []
    const ep = datalayerData.extract_pipeline

    if (!ep) return assets

    const cleanName = (n: string) => n.trim().replace(".parquet", "")

    // Extracted directly from backend JSON arrays
    if (Array.isArray(ep.bronze_tables)) {
      ep.bronze_tables.forEach((name: string) => {
        if (name?.trim()) {
          assets.push({ name: name.trim(), layer: "Bronze", status: "Success" })
          assets.push({ name: cleanName(name), layer: "Gold", status: "Success" })
        }
      })
    } else if (Array.isArray(ep.parquet_files)) {
      ep.parquet_files.forEach((name: string) => {
        if (name?.trim()) {
          assets.push({ name: name.trim(), layer: "Bronze", status: "Success" })
          assets.push({ name: cleanName(name), layer: "Gold", status: "Success" })
        }
      })
    }

    if (Array.isArray(ep.silver_tables)) {
      ep.silver_tables.forEach((name: string) => {
        if (name?.trim()) assets.push({ name: cleanName(name), layer: "Silver", status: "Success" })
      })
    } else if (typeof ep.silver_tables_processing === 'string' && ep.silver_tables_processing !== "Deferred to Fabric Notebook") {
      ep.silver_tables_processing.split(',').forEach((n: string) => {
        if (n.trim()) assets.push({ name: cleanName(n), layer: "Silver", status: "Success" })
      })
    }

    if (Array.isArray(ep.gold_tables)) {
      ep.gold_tables.forEach((name: string) => {
        if (name?.trim()) assets.push({ name: cleanName(name), layer: "Gold", status: "Success" })
      })
    } else if (typeof ep.gold_tables_processing === 'string' && ep.gold_tables_processing !== "Deferred to Fabric Notebook") {
      ep.gold_tables_processing.split(',').forEach((n: string) => {
        if (n.trim()) assets.push({ name: cleanName(n), layer: "Gold", status: "Success" })
      })
    }

    return assets
  }, [datalayerData])

  const filteredTableData = useMemo(() => {
    if (filterLayer === "All") return tableData
    return tableData.filter(item => item.layer === filterLayer)
  }, [tableData, filterLayer])

  const assetsPagination = usePagination(filteredTableData, 10);

  // Derive lakehouse info
  const lakehouses = useMemo(() => {
    if (!datalayerData || !datalayerData.lakehouse) return []
    return [
      {
        name: datalayerData.lakehouse.name || "Fabric Lakehouse",
        tables: datalayerData.pipeline_summary?.gold_delta_tables || datalayerData.pipeline_summary?.gold_tables_created || 0,
        id: datalayerData.lakehouse.id
      }
    ]
  }, [datalayerData])

  const requirements = [
    "Re-point connections (e.g., Tableau live query → Fabric Direct Lake) or migrate extracts (Hyper → Delta tables in OneLake).",
    "Use Fabric Data Pipelines or PySpark notebooks for bulk loads; support medallion architecture.",
    "Handle common sources: SQL Server, Snowflake, CSV, XLSX.",
    "Validate connections post-migration.",
    "Custom SQL with parameters → parameterized Fabric queries."
  ]

  const translationDetails = [
    { source: "Live connections", target: "Direct Lake semantic model" },
    { source: "Tableau Extracts", target: "Delta Lake tables in OneLake" },
    { source: "Custom SQL", target: "Fabric SQL Endpoint" },
    { source: "Blended sources", target: "Composite models" },
    { source: "Parameters", target: "Dynamic M queries" }
  ]

  if (storeError) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ color: "#dc2626", fontWeight: 600 }}>Error: {storeError}</div>
      </div>
    )
  }

  if (isLoading && !datalayerData) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Spinner size="large" label="Fetching live Data Layer results..." />
      </div>
    )
  }

  if (!datalayerData) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ fontWeight: 500, color: "#64748b" }}>No Data Layer results available for this workbook yet. Run the agent to see live data.</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div className={styles.title}>Data Layer Results</div>
        <div className={styles.subtitle}>Fabric Lakehouse Environment & Data Asset Migration Status</div>
      </div>

      {/* ── SECTION 1: METRICS ── */}
      <div className={styles.metricsGrid}>
        {metrics.map((m, idx) => (
          <div key={idx} className={styles.metricCard}>
            <div className={styles.metricValue}>
              {typeof m.value === 'number' && m.label !== "Processing Mode" ? m.value.toLocaleString() : m.value}
            </div>
            <div className={styles.metricLabel}>{m.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.grid2}>
        {/* ── SECTION 2: MEDALLION ARCHITECTURE ── */}
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}><Database size={20} /> Medallion Architecture Summary</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "16px",
            marginTop: "16px"
          }}>
            {/* Bronze Component */}
            <div style={{ padding: "24px 20px", borderRadius: "8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5)", backgroundColor: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Bronze</div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Raw Data</div>
              <div style={{ marginTop: "12px", fontSize: "20px", fontWeight: 700 }}>
                {datalayerData.pipeline_summary?.bronze_tables_created ?? datalayerData.extract_pipeline?.bronze_tables?.length ?? 0}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Tables</div>
            </div>

            {/* Silver Component */}
            {/* <div style={{ padding: "24px 20px", borderRadius: "8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5)", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Silver</div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Cleansed</div>
              <div style={{ marginTop: "12px", fontSize: "20px", fontWeight: 700 }}>
                {datalayerData.pipeline_summary?.silver_tables_created || 0}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Enriched</div>
            </div> */}

            {/* Gold Component */}
            <div style={{ padding: "24px 20px", borderRadius: "8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.5)", backgroundColor: "#fefce8", border: "1px solid #fef08a", color: "#a16207", position: "relative" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Gold</div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Analytics</div>
              <div style={{ marginTop: "12px", fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                {datalayerData.pipeline_summary?.gold_delta_tables ?? datalayerData.pipeline_summary?.gold_tables_created ?? datalayerData.extract_pipeline?.gold_tables?.length ?? 0}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.8 }}>Assets</div>
            </div>
          </div>
        </Card>

        {/* ── SECTION 3: FABRIC ENVIRONMENT ── */}
        <Card className={styles.sectionCard}>
          <div className={styles.sectionHeader}><Settings size={20} /> Fabric Workspace Environment</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            {lakehouses.map((lh, idx) => (
              <div key={idx} style={{ padding: "20px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Title & Badge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                  <div style={{ fontWeight: 500, color: "#0f172a", fontSize: "16px", wordBreak: "break-all" }}>{lh.name}</div>
                  <Badge variant="success">Active Status</Badge>
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px solid #e2e8f0", margin: "4px 0" }}></div>

                {/* Metric Cards */}
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: "150px", flex: "1 1 0", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Parameter Tables</div>
                    <div style={{ fontSize: "24px", fontWeight: 500, color: "#0f172a" }}>
                        {datalayerData.pipeline_summary?.parameter_tables_to_be_created || 0}
                    </div>
                  </div>

                  <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: "150px", flex: "1 1 0", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Calculated Fields</div>
                    <div style={{ fontSize: "24px", fontWeight: 500, color: "#0f172a" }}>{datalayerData.pipeline_summary?.calculated_fields_injected || 0}</div>
                  </div>

                  {/* <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", minWidth: "150px", flex: "1 1 0", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Workspace Tier</div>
                    <div style={{ fontSize: "24px", fontWeight: 500, color: "#0f172a" }}>{datalayerData.workspace_tier || "Standard (F64)"}</div>
                  </div> */}
                </div>

              </div>
            ))}
            {lakehouses.length === 0 && (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
                No Lakehouse artifacts detected.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── SECTION 4: DATA ASSETS ── */}
      <Card className={styles.sectionCard}>
        <div className={styles.sectionHeader}><ArrowRight size={20} /> Target Data Assets (Delta Tables)</div>

        <div className="vl-flex-col-mobile" style={{ padding: "12px 16px", background: "#f1f5f9", borderRadius: "8px", marginTop: "16px", marginBottom: "16px" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
             <span style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>Filter by Layer:</span>
             <div style={{ display: "flex", gap: "8px" }}>
               {["Gold", "Bronze"].map(layer => (
                 <button
                   key={layer}
                   onClick={() => setFilterLayer(layer)}
                   style={{
                     padding: "4px 12px",
                     borderRadius: "20px",
                     fontSize: "12px",
                     fontWeight: 500,
                     cursor: "pointer",
                     border: "1px solid #e2e8f0",
                     backgroundColor: filterLayer === layer ? "#0f172a" : "#ffffff",
                     color: filterLayer === layer ? "#ffffff" : "#475569",
                     transition: "all 0.2s"
                   }}
                 >
                   {layer}
                 </button>
               ))}
             </div>
           </div>
           <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
             <span style={{ fontSize: "14px", color: "#64748b" }}>Showing:</span>
             <strong style={{ fontSize: "16px", color: "#0f172a" }}>{filteredTableData.length}</strong>
             <span style={{ fontSize: "14px", color: "#64748b" }}>of</span>
             <strong style={{ fontSize: "16px", color: "#0f172a" }}>{tableData.length}</strong>
           </div>
        </div>

        <div className={styles.tableContainer}>
          <table style={{ tableLayout: "fixed", width: "100%", minWidth: "650px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ width: "45%", fontWeight: 600, color: "#475569", textAlign: "left", padding: "10px 12px" }}>Table Name</th>
                <th style={{ width: "20%", fontWeight: 600, color: "#475569", textAlign: "left", padding: "10px 12px" }}>Fabric Layer</th>
                <th style={{ width: "35%", fontWeight: 600, color: "#475569", textAlign: "left", padding: "10px 12px" }}>Migration Result</th>
              </tr>
            </thead>
            <tbody>
              {assetsPagination.pageItems.map((tbl, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 500, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tbl.name}</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge
                      variant={tbl.layer === "Gold" ? "warning" : tbl.layer === "Silver" ? "secondary" : "default"}
                    >
                      {tbl.layer}
                    </Badge>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge variant="success" style={{ whiteSpace: "nowrap" }}>Migrated Successfully</Badge>
                  </td>
                </tr>
              ))}
              {tableData.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '30px', color: "#64748b", fontSize: "14px" }}>
                    No delta tables processed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {assetsPagination.needsPagination && (
          <PaginationControls 
            page={assetsPagination.page} 
            totalPages={assetsPagination.totalPages} 
            total={assetsPagination.total} 
            setPage={assetsPagination.setPage} 
          />
        )}
      </Card>

      {/* ── SECTION 5: TECH SPEC ── */}
      <Card className={styles.sectionCard}>
        <div 
          className={styles.sectionHeaderRow} 
          onClick={() => toggleSection("techSpec")}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        >
          {openSections.techSpec ? <ChevronDown size={20} color="#475569" /> : <ChevronRight size={20} color="#475569" />}
          <div className={styles.sectionHeader} style={{ margin: 0 }}>
             Agent Internal Logic & Conversion Rules
          </div>
        </div>

        {openSections.techSpec && (
          <div className={styles.grid2} style={{ paddingTop: "20px", marginTop: "16px", borderTop: "1px solid #e2e8f0" }}>

            {/* Requirements Block */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px", color: "#1e293b" }}>
                Agent Requirements
              </div>
              {requirements.map((req, idx) => (
                <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <CheckCircle2 size={20} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>{req}</div>
                </div>
              ))}
            </div>

            {/* Translations Block */}
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px", color: "#1e293b" }}>
                Direct-Lake Translation Mapping
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>Source Type</th>
                      <th style={{ padding: "12px 16px", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 600 }}>Fabric Equivalent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {translationDetails.map((d, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "12px 16px", color: "#1e293b", fontWeight: 500 }}>{d.source}</td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{d.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </Card>
    </div>
  )
}

export default DataLayerTab;
