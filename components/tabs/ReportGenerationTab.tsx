"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, FileText, GitBranch, Info } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGenerationStore } from "@/stores/generation.store"

/* ═══════════════════════════════════════════════════════════════════════
   STYLES — global vl-* classes (same system as ValidationTab / ParsingTab)
═══════════════════════════════════════════════════════════════════════ */
const useStyles = () => ({
    container: "vl-container",
    header: "vl-header",
    title: "vl-title",
    subtitle: "vl-subtitle",
    metricValue: "vl-metric-value",
    metricLabel: "vl-metric-label",
    metricCard: "vl-metric-card",
    tabsCard: "vl-tabs-card",
    tabListWrapper: "vl-tab-list-wrapper",
    tabList: "vl-tab-list",
    tabContent: "vl-tab-content",
    sectionCard: "vl-section-card",
    sectionHeader: "vl-section-header",
    infoItem: "vl-info-item",
    infoLabel: "vl-info-label",
    infoValue: "vl-info-value",
    grid2: "vl-grid-2",
    grid3: "vl-grid-3",
    grid4: "vl-grid-4",
    detailItem: "vl-info-item", // Using vl-info-item for standard card-within-card look
})

/* ═══════════════════════════════════════════════════════════════════════
   Main Component
═══════════════════════════════════════════════════════════════════════ */
interface ReportGenerationTabProps {
    workbookId?: string;
    workbookName?: string;
    projectId?: string;
    runId?: string;
    workspaceName?: string;
}

type SubTab = "summary" | "instructions" | "deployment"

export function ReportGenerationTab({ workbookId, workbookName, projectId, runId, workspaceName: propWorkspaceName }: ReportGenerationTabProps) {
    const styles = useStyles()
    const [subTab, setSubTab] = useState<SubTab>("summary")
    const [localWorkspaceName, setLocalWorkspaceName] = useState("")

    useEffect(() => {
        if (typeof window !== "undefined") {
            const storedName = localStorage.getItem("selected_workspace_name") || ""
            setLocalWorkspaceName(storedName)
        }
    }, [])

    const generationDataMap = useGenerationStore(state => state.generationData)
    const generationRawMap = useGenerationStore(state => state.generationRaw)
    const isLoadingMap = useGenerationStore(state => state.isLoading)
    const errorMap = useGenerationStore(state => state.error)

    const data = workbookId ? generationDataMap[workbookId] : null
    const rawResponse = workbookId ? generationRawMap[workbookId] : null
    const isLoading = workbookId ? isLoadingMap[workbookId] : false
    const storeError = workbookId ? errorMap[workbookId] : null

    // Debug logs as requested for troubleshooting generation failures
    if (data || rawResponse) {
        console.log("[GenerationResult] Raw response:", rawResponse || data);
        console.log("[GenerationResult] Failed message:", data?.message);
    }

    const isHistoricalRun = !!runId
    const hasData = !!data

    const displayName = workbookName || data?.project?.name || workbookId || "Unknown Application"
    const statusMsg = data?.status || "Unknown"
    const isSuccess = statusMsg.toLowerCase() === "success" || statusMsg.toLowerCase() === "completed"

    // Standardized Loading State (Header-less Card)
    if ((isHistoricalRun && !hasData && isLoading) || (!hasData && isLoading)) {
        return (
            <div className={styles.container}>
                <Card className={styles.sectionCard} style={{ padding: "60px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spinner size="large" label={isHistoricalRun ? "Fetching historical report generation results..." : "Waiting for report generation to complete..."} />
                </Card>
            </div>
        )
    }

    if (storeError && !hasData) {
        return (
            <div className={styles.container}>
                <Card className={styles.sectionCard} style={{ padding: "40px" }}>
                    <span style={{ fontWeight: 600, color: "#dc2626", fontSize: "16px" }}>Error: {storeError}</span>
                </Card>
            </div>
        )
    }

    if (!hasData) {
        return (
            <div className={styles.container}>
                <Card className={styles.sectionCard} style={{ padding: "40px", textAlign: "center" }}>
                    <span style={{ fontSize: "18px", color: "var(--text-muted)" }}>No generation data available yet.</span>
                </Card>
            </div>
        )
    }

    let rawObj = rawResponse;
    if (Array.isArray(rawResponse) && rawResponse.length > 0) {
        rawObj = rawResponse[0];
    }
    const unwrappedData = rawObj?.final_response || rawObj?.payload || rawObj;
    const rawProject = unwrappedData?.project;

    const deploymentType = data?.project?.deployment_type || rawProject?.deployment_type || unwrappedData?.deployment_type || "—";
    const isDirectFabric = typeof deploymentType === "string" && (deploymentType.toLowerCase() === "direct fabric" || deploymentType.toLowerCase() === "direct_fabric");

    const workspaceName = data?.project?.workspace_name
        || rawProject?.workspace_name
        || unwrappedData?.workspace_name
        || (data?.project?.destination_path ? data.project.destination_path.split('/')[1] : null)
        || (rawProject?.destination_path ? rawProject.destination_path.split('/')[1] : null)
        || propWorkspaceName
        || localWorkspaceName
        || "—";

    return (
        <div className={styles.container}>

            {/* ── HEADER ── */}
            <div className={styles.header} style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    <span className={styles.title} style={{ fontSize: "32px", fontWeight: 600 }}>Report Generation Results</span>
                    <span className={styles.subtitle}>
                        Generation output and deployment details for <span style={{ color: "#0f172a", fontWeight: 600 }}>{displayName}</span>
                    </span>
                </div>
                {!isSuccess && (
                    <Badge variant="destructive" style={{ padding: "4px 12px", fontSize: "13px", fontWeight: "bold", flexShrink: 0, marginTop: "4px" }}>
                        FAILED
                    </Badge>
                )}
            </div>

            {isSuccess ? (
                <>
                    {/* ── SUMMARY CARDS ── */}
                    <div className={styles.grid3} style={{ marginBottom: "24px" }}>
                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>
                                {displayName}
                            </div>
                            <div className={styles.metricLabel}>APPLICATION NAME</div>
                        </Card>

                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>
                                {deploymentType}
                            </div>
                            <div className={styles.metricLabel}>DEPLOYMENT TYPE</div>
                        </Card>

                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>
                                {workspaceName}
                            </div>
                            <div className={styles.metricLabel}>WORKSPACE NAME</div>
                        </Card>
                    </div>

            {/* ── SUB-TAB SELECTOR ── */}
            <Card className={styles.tabsCard} style={{ padding: 0 }}>
                <div className={styles.tabListWrapper} style={{
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                    borderBottom: `1px solid var(--border)`
                }}>
                    <style>{`
                        .${styles.tabListWrapper}::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                    <Tabs value={subTab} onValueChange={(value: string) => setSubTab(value as SubTab)}>
                        <TabsList className={styles.tabList} style={{ minWidth: "max-content", border: "none" }}>
                            <TabsTrigger value="summary"><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><FileText size={20} />Summary</span></TabsTrigger>
                            <TabsTrigger value="deployment"><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><GitBranch size={20} />Deployment Details</span></TabsTrigger>
                            <TabsTrigger value="instructions"><span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Info size={20} />Instructions</span></TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                <div className={styles.tabContent}>

                {/* ── SUMMARY CONTENT ── */}
                {subTab === "summary" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <Card className={styles.sectionCard} style={{ margin: 0 }}>
                            <div className={styles.sectionHeader}>Generation Summary</div>
                            <span className={styles.subtitle} style={{ marginBottom: "20px", display: "block" }}>
                                Detailed breakdown of items processed during report generation
                            </span>

                            {data?.summary && (
                                <div className={styles.grid3}>
                                    {[
                                        { label: "Pages Generated", value: data.summary.pages_generated },
                                        { label: "Tables Processed", value: data.summary.tables_processed },
                                        { label: "Custom SQL Tables", value: data.summary.custom_sql_tables },
                                        {
                                            label: "DAX Measures Created",
                                            value: (data.summary.measures_identified && data.summary.measures_identified > data.summary.measures_created)
                                                ? `${data.summary.measures_created} / ${data.summary.measures_identified}`
                                                : data.summary.measures_created
                                        },
                                        { label: "Visuals Generated", value: data.summary.visuals_generated },
                                        { label: "Parameters", value: data.summary.parameters_generated },
                                    ].map((m, idx) => {
                                        return (
                                            <div key={idx} className={styles.metricCard}>
                                                <div className={styles.metricValue}>
                                                    {m.value ?? 0}
                                                </div>
                                                <div className={styles.metricLabel}>{m.label}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <div className={styles.infoItem} style={{
                            background: isSuccess ? "#f0fdf4" : "#fef2f2",
                            borderLeft: `4px solid ${isSuccess ? "#22c55e" : "#ef4444"}`,
                            margin: 0,
                            padding: "20px"
                        }}>
                            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                                {isSuccess ? (
                                    <CheckCircle2 style={{ color: "#22c55e", flexShrink: 0 }} size={28} />
                                ) : (
                                    <XCircle style={{ color: "#ef4444", flexShrink: 0 }} size={28} />
                                )}
                                <div>
                                    <span style={{ fontWeight: 600, fontSize: "16px", color: "#0f172a", display: "block", marginBottom: "4px" }}>
                                        Report Status
                                    </span>
                                    <span style={{ fontSize: "14px", color: "#475569", display: "block", marginBottom: "12px", lineHeight: "1.6" }}>
                                        {data?.message || (isSuccess ? "Your Power BI project has been generated and deployed successfully." : "Report generation failed or is incomplete.")}
                                    </span>
                                    {data?.project?.fabric_url && (
                                        <a
                                            href={data.project.fabric_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                fontSize: "14px",
                                                color: "var(--primary)",
                                                textDecoration: "none",
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px"
                                            }}
                                        >
                                            View Report in Microsoft Fabric →
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── DEPLOYMENT CONTENT ── */}
                {subTab === "deployment" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <Card className={styles.sectionCard} style={{ margin: 0 }}>
                            <div className={styles.sectionHeader}>Deployment Repository Details</div>
                            <span className={styles.subtitle} style={{ marginBottom: "20px", display: "block" }}>
                                Technical details regarding the generated project&apos;s location and structure
                            </span>

                            <div className={styles.grid2}>
                                {!isDirectFabric && (
                                    <div className={styles.detailItem}>
                                        <div className={styles.infoLabel}>Repository</div>
                                        <div className={styles.infoValue} style={{ wordBreak: "break-all" }}>{data?.project?.repository || "—"}</div>
                                    </div>
                                )}

                                {!isDirectFabric && (
                                    <div className={styles.detailItem}>
                                        <div className={styles.infoLabel}>Branch</div>
                                        <div className={styles.infoValue}>{data?.project?.branch || "—"}</div>
                                    </div>
                                )}

                                <div className={styles.detailItem}>
                                    <div className={styles.infoLabel}>Project Folder</div>
                                    <div className={styles.infoValue}>{data?.project?.name || "—"}</div>
                                </div>

                                {!isDirectFabric && (
                                    <div className={styles.detailItem}>
                                        <div className={styles.infoLabel}>Destination Path</div>
                                        <div className={styles.infoValue} style={{ wordBreak: "break-all" }}>{data?.project?.destination_path || "—"}</div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {/* ── INSTRUCTIONS CONTENT ── */}
                {subTab === "instructions" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <Card className={styles.sectionCard} style={{ margin: 0 }}>
                            <div className={styles.sectionHeader}>Post-Generation Instructions</div>
                            <span className={styles.subtitle} style={{ marginBottom: "20px", display: "block" }}>
                                Steps required to finalize the report in Fabric
                            </span>
                            <div className={styles.infoItem} style={{ borderLeft: "4px solid #3b82f6", background: "#f8fafc" }}>
                                <span style={{ fontSize: "14px", color: "#334155", lineHeight: "1.7" }}>
                                    1. Log in to the <a href="https://app.fabric.microsoft.com/" target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "var(--primary)" }}>Fabric Portal</a>.<br />
                                    2. Locate the folder <strong>{data?.project?.name}</strong>.<br />
                                    3. Verify data source connections and refresh the semantic model.
                                </span>
                            </div>
                        </Card>
                    </div>
                )}
                </div>
            </Card>
                </>
            ) : (
                <Card className={styles.sectionCard} style={{
                    padding: "40px",
                    background: "#fef2f2",
                    borderLeft: "6px solid #ef4444",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <XCircle style={{ color: "#ef4444" }} size={32} />
                        <span style={{ fontSize: "20px", fontWeight: 700, color: "#991b1b" }}>
                            Report Generation Failed
                        </span>
                    </div>

                    <div style={{ paddingLeft: "44px" }}>
                        <span style={{ fontSize: "16px", color: "#7f1d1d", lineHeight: "1.6", display: "block", marginBottom: "8px" }}>
                            The report generation process encountered a critical error and could not be completed.
                        </span>

                        <div style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            padding: "16px",
                            borderRadius: "8px",
                            border: "1px solid rgba(239, 68, 68, 0.2)"
                        }}>
                            <span style={{ fontWeight: 600, color: "#991b1b", display: "block", marginBottom: "4px" }}>
                                Error Message:
                            </span>
                            <span style={{ color: "#b91c1c", fontFamily: "monospace", fontSize: "14px", wordBreak: "break-all", overflowWrap: "anywhere", display: "block", overflow: "hidden" }}>
                                {data?.message || "Internal server error occurred during generation."}
                            </span>
                        </div>


                    </div>
                </Card>
            )}
        </div>
    )
}

export default ReportGenerationTab
