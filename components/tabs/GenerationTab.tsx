"use client"

import { useGenerationStore } from "@/stores/generation.store"
import { useAgentStore } from "@/stores/agent.store"
import { matchesAgent } from "@/lib/agentNames"
import {
    Badge,
    Card,
    Spinner,
    Text,
    tokens,
    makeStyles,
    shorthands,
} from "@fluentui/react-components"
import {
    CheckmarkCircle24Regular,
    DocumentBulletList24Regular,
    ArrowCircleRight24Regular,
    Database24Regular,
    Cloud24Regular,
    ErrorCircle24Regular,
    BrainCircuit24Regular,
    DeviceEq24Regular,
    Open24Regular,
} from "@fluentui/react-icons"
import { useMemo } from "react"

const useStyles = () => ({
    container: "vl-container",
    header: "vl-header",
    title: "vl-title",
    subtitle: "vl-subtitle",
    metricsGrid: "vl-grid-4",
    metricCard: "vl-metric-card",
    metricValue: "vl-metric-value",
    metricLabel: "vl-metric-label",
    sectionCard: "vl-section-card",
    sectionTitle: "vl-section-header",
    artifactItem: "vl-list-item",
    statusCard: "vl-section-card",
    fabricLink: "vl-blue-pill-badge",
    grid3: "vl-grid-3",
    infoLabel: "vl-info-label",
    infoValue: "vl-info-value",
})

interface GenerationTabProps {
    workbookId: string
    projectId?: string
    runId?: string
}

export function GenerationTab({ workbookId, projectId, runId }: GenerationTabProps) {
    const styles = useStyles()
    const generationDataMap = useGenerationStore(state => state.generationData)
    const isLoadingMap = useGenerationStore(state => state.isLoading)
    const data = workbookId ? generationDataMap[workbookId] : null
    const isLoading = workbookId ? isLoadingMap[workbookId] : false

    const { activities } = useAgentStore()
    const currentRunId = runId || useAgentStore.getState().currentRunId

    const isComplete = useMemo(() => {
        if (!currentRunId || !workbookId || !activities[currentRunId]?.[workbookId]) return false
        const acts = activities[currentRunId][workbookId].filter(a => matchesAgent(a.agent_name, 'generation'))
        return acts.some(a => ["completed", "success", "failed", "error"].includes(a.status?.toLowerCase()))
    }, [activities, currentRunId, workbookId])

    if (isLoading && !data) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "100px" }}>
                <Spinner label="Fetching generation results..." />
            </div>
        )
    }

    if (!data) {
        return (
            <Card style={{ margin: "40px", padding: "60px", textAlign: "center" }}>
                <Text size={400} style={{ color: tokens.colorNeutralForeground4 }}>
                    {isComplete ? "No generation data found." : "Waiting for report generation to complete..."}
                </Text>
            </Card>
        )
    }

    const { summary, project, status, message } = data
    const isSuccess = status.toLowerCase() === "success" || status.toLowerCase() === "completed"

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.title}>Report Generation Agent</div>
                    <div className={styles.subtitle} style={{ marginTop: "4px" }}>
                        Digital twin creation and Fabric deployment for <strong style={{ color: tokens.colorNeutralForeground1 }}>{project.name}</strong>
                    </div>
                </div>
                <Badge 
                    appearance="filled" 
                    color={isSuccess ? "success" : "danger"}
                    size="large"
                    shape="rounded"
                    style={{ padding: "8px 16px", fontSize: "12px", fontWeight: 700 }}
                >
                    {status.toUpperCase()}
                </Badge>
            </div>

            {isSuccess ? (
                <>
                    {/* Metrics - Only show on SUCCESS */}
                    <div className={styles.metricsGrid}>
                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>{summary.pages_generated}</div>
                            <div className={styles.metricLabel}>Pages Generated</div>
                        </Card>
                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>{summary.visuals_generated}</div>
                            <div className={styles.metricLabel}>Visuals Generated</div>
                        </Card>
                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>{summary.measures_created}</div>
                            <div className={styles.metricLabel}>DAX Measures Created</div>
                        </Card>
                        <Card className={styles.metricCard}>
                            <div className={styles.metricValue}>{summary.tables_processed}</div>
                            <div className={styles.metricLabel}>Tables Processed</div>
                        </Card>
                    </div>

                    {/* Project Details - Only show on SUCCESS */}
                    <Card className={styles.sectionCard}>
                        <div className={styles.sectionTitle}>
                            <BrainCircuit24Regular />
                            Deployment & Workflow Details
                        </div>
                        <div className={styles.grid3}>
                            <div className={styles.artifactItem}>
                                <div className={styles.infoLabel}>Repository</div>
                                <div className={styles.infoValue}>{project.repository}</div>
                            </div>
                            <div className={styles.artifactItem}>
                                <div className={styles.infoLabel}>Branch</div>
                                <div className={styles.infoValue}>{project.branch}</div>
                            </div>
                            <div className={styles.artifactItem}>
                                <div className={styles.infoLabel}>Destination Path</div>
                                <div className={styles.infoValue}>{project.destination_path || "/root"}</div>
                            </div>
                        </div>
                    </Card>

                    {/* Status & Fabric Link - SUCCESS Version */}
                    <div 
                        className={styles.statusCard} 
                        style={{ borderLeft: `6px solid ${tokens.colorPaletteGreenForeground1}` }}
                    >
                        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                            <div style={{ 
                                background: tokens.colorStatusSuccessBackground3,
                                padding: "10px",
                                borderRadius: "12px",
                                display: "flex"
                            }}>
                                <CheckmarkCircle24Regular style={{ color: tokens.colorStatusSuccessForeground1 }} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: "16px", color: tokens.colorNeutralForeground1, marginBottom: "4px" }}>
                                    Generation & Deployment Successful
                                </div>
                                <div style={{ color: tokens.colorNeutralForeground2, fontSize: "14px" }}>
                                    {message || "The project has been successfully synthesized and deployed to Microsoft Fabric workspace."}
                                </div>
                            </div>
                        </div>

                        {project.fabric_url && (
                            <div style={{ marginTop: "16px" }}>
                                <a href={project.fabric_url} target="_blank" rel="noopener noreferrer" className={styles.fabricLink} style={{ textDecoration: "none" }}>
                                    Launch Microsoft Fabric Workspace <Open24Regular fontSize="16px" style={{ marginLeft: "8px" }} />
                                </a>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* ❌ FAILED STATE UI - Centered error container */
                <Card 
                    className={styles.statusCard} 
                    style={{ 
                        borderLeft: `6px solid ${tokens.colorPaletteRedForeground1}`,
                        padding: "32px",
                        marginTop: "20px"
                    }}
                >
                    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                        <div style={{ 
                            background: tokens.colorStatusDangerBackground3,
                            padding: "12px",
                            borderRadius: "12px",
                            display: "flex"
                        }}>
                            <ErrorCircle24Regular style={{ color: tokens.colorStatusDangerForeground1, fontSize: "32px" }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: "20px", color: tokens.colorNeutralForeground1, marginBottom: "8px" }}>
                                Report Generation Failed
                            </div>
                            <div style={{ 
                                color: tokens.colorNeutralForeground2, 
                                fontSize: "15px", 
                                lineHeight: "1.6",
                                backgroundColor: tokens.colorNeutralBackground3,
                                padding: "16px",
                                borderRadius: "8px",
                                border: `1px solid ${tokens.colorNeutralStroke1}`,
                                fontFamily: "Consolas, monospace",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-all",
                                overflowWrap: "anywhere",
                                overflow: "hidden"
                            }}>
                                {message || "The agent encountered a critical error during the generation phase. Please check the monitoring logs for more details."}
                            </div>
                            <div style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}>
                                <Badge color="danger" appearance="outline">Action Required</Badge>
                                <Text size={200} style={{ color: tokens.colorNeutralForeground4 }}>
                                    Please resolve the issue mentioned above and re-run the generation.
                                </Text>
                            </div>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
