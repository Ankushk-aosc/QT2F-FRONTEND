"use client"

import React, { useMemo, useCallback, useState, useEffect } from "react"
import {
  Card,
  makeStyles,
  mergeClasses,
  tokens,
  Text,
  shorthands,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Spinner,
} from "@fluentui/react-components"
import {
  DocumentDatabase24Regular,
  DatabaseSearch24Regular,
  Layer24Regular,
  BrainCircuit24Regular,
  Table24Regular,
  Settings24Regular,
  DocumentPdf24Regular,
  ArrowRight24Regular,
} from "@fluentui/react-icons"
import { useAgentStore } from "@/stores/agent.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { useParsingStore } from "@/stores/parsing.store"
import { useUIStore } from "@/stores/ui.store"
import { useGenerationStore } from "@/stores/generation.store"

import { OnlyAssessmentTab, SectionHeading } from "@/components/tabs/OnlyAssessmentTab"
import dynamic from "next/dynamic"

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "32px",
    backgroundColor: tokens.colorNeutralBackground2,
    minHeight: "100%",
  },
  heroBanner: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: "16px",
    padding: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    position: "relative",
    marginBottom: "8px",
    overflow: "hidden",
    boxShadow: tokens.shadow4,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  roadmapContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    padding: "0 20px",
  },
  intelligenceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    width: "100%",
  },
  tileIcon: {
    fontSize: "24px",
    color: tokens.colorBrandForeground1,
  },
  sparkline: {
    height: "4px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: "2px",
    marginTop: "12px",
    overflow: "hidden",
  },
  sparklineBar: {
    height: "100%",
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: "2px",
    transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  stepIndicator: {
    height: "24px",
    width: "24px",
    borderRadius: "50%",
    backgroundColor: tokens.colorNeutralStroke2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    transition: "all 0.3s ease",
    "&.active": {
      backgroundColor: tokens.colorBrandBackground,
      color: "#fff",
    },
    "&.done": {
      backgroundColor: tokens.colorPaletteGreenBackground3,
      color: "#fff",
    }
  },
  stepLine: {
    position: "absolute",
    top: "8px",
    left: "50%",
    width: "100%",
    height: "2px",
    backgroundColor: tokens.colorNeutralStroke2,
    zIndex: 2,
    "&.done": {
      backgroundColor: tokens.colorPaletteGreenBackground3,
    }
  },
  stepLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground3,
    transition: "all 0.3s ease",
    "&.active": {
      color: tokens.colorBrandForeground1,
    },
    "&.done": {
      color: tokens.colorNeutralForeground1,
    }
  },
  heroStatusLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "12px 32px",
    borderRadius: tokens.borderRadiusCircular,
    width: "fit-content",
    margin: "0 auto",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  heroActionArea: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    marginBottom: "32px",
  },
  headerActionsContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  downloadButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: "220px",
    fontSize: tokens.fontSizeBase400,
    ...shorthands.padding("12px", "32px"),
  },
  roadmapTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: tokens.colorNeutralForeground4,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    textAlign: "center",
  },
  roadmapStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    position: "relative",
    flex: 1,
  },
  statusBadge: {
    height: "10px",
    width: "10px",
    borderRadius: "50%",
    position: "relative",
  }
})

export function MigrationOverview({ isPdfMode = false, onRequestPdf }: { isPdfMode?: boolean; onRequestPdf?: () => void }) {
  const styles = useStyles()
  const { currentRunId, currentWorkbookIds, assessmentData, assessmentActivitiesDone, parsingActivitiesDone, mappingActivitiesDone, generationActivitiesDone, validationActivitiesDone } = useAgentStore()
  const { selectedProject, selectedProjectName, selectedSite, selectedProjects, selectedProjectNames, tableauSiteName, selectedWorkspaceName } = useDashboardStore()
  const parsingDataMap = useParsingStore(state => state.parsingData)
  const locGenerationData = useGenerationStore(state => state.generationData)
  const { dataLayerEnabled, hasContinued } = useUIStore()

  // --- Dynamic Scope Calculation ---

  // As requested: Log the complete source object being passed to the PDF
  if (isPdfMode) {
    const sourceData = {
      selectedSite,
      tableauSiteName,
      selectedWorkspaceName,
      selectedProjects,
      selectedProjectNames,
      selectedProjectName,
      currentWorkbookIds,
      // We log a summary of the backend payloads to keep the console output manageable but verifiable
      assessmentDataSnapshots: currentWorkbookIds.map(id => ({
        id,
        payload_site: assessmentData[currentRunId || ""]?.[id]?.payload?.site_name,
        payload_workspace: assessmentData[currentRunId || ""]?.[id]?.payload?.workspace_name,
        payload_project: assessmentData[currentRunId || ""]?.[id]?.payload?.project_name,
      }))
    };
    console.log("Migration Overview Source Data", sourceData);
  }

  const { siteNames, workspaceNames, projectNames, workbookNames } = useMemo(() => {
    const sNames = new Set<string>();
    // Strictly prefer the exact UI selection
    if (tableauSiteName) sNames.add(tableauSiteName);
    else if (selectedSite) sNames.add(selectedSite);

    const wNames = new Set<string>();
    // Strictly prefer the exact UI selection
    if (selectedWorkspaceName) wNames.add(selectedWorkspaceName);
    // Fallback to local storage if store was wiped but page wasn't refreshed
    else if (typeof window !== "undefined" && localStorage.getItem("selected_workspace_name")) {
      wNames.add(localStorage.getItem("selected_workspace_name")!);
    }

    const pNames = new Set<string>();
    // Regular expression to identify standard GUIDs (e.g. c21a41fc-f6b7-4abb-9dd0-6a806cf49726)
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    if (selectedProjects && selectedProjects.length > 0) {
      selectedProjects.forEach(id => pNames.add(selectedProjectNames?.[id] || id));
    } else if (selectedProjectName) {
      pNames.add(selectedProjectName);
    }

    const wbNames: string[] = [];

    currentWorkbookIds.forEach(id => {
      const entry = assessmentData[currentRunId || ""]?.[id];
      const payload = entry?.payload || {};
      const gData = locGenerationData[id];

      // Fallbacks if not set globally
      if (sNames.size === 0 && (payload.site_name || entry?.site_name)) {
        sNames.add(payload.site_name || entry?.site_name);
      }

      if (wNames.size === 0 && (gData?.project?.workspace_name || payload.workspace_name || entry?.workspace_name || payload.fabric_workspace)) {
        wNames.add(gData?.project?.workspace_name || payload.workspace_name || entry?.workspace_name || payload.fabric_workspace);
      }

      if (payload.project_name || entry?.project_name) {
        pNames.add(payload.project_name || entry?.project_name);
      }

      const wbName = payload.workbook_name || entry?.workbook_name || parsingDataMap[id]?.workbook_name || id;
      wbNames.push(wbName);
    });

    // Remove any GUIDs from projectNames to satisfy the requirement
    const finalProjectNames = Array.from(pNames).filter(name => !guidRegex.test(name));

    return {
      siteNames: Array.from(sNames),
      workspaceNames: Array.from(wNames),
      projectNames: finalProjectNames,
      workbookNames: wbNames
    };
  }, [selectedSite, tableauSiteName, selectedWorkspaceName, selectedProjects, selectedProjectNames, selectedProjectName, currentWorkbookIds, assessmentData, currentRunId, parsingDataMap, locGenerationData]);

  // --- Logic from ResultTab.tsx ---
  const isAllAssessmentDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!assessmentActivitiesDone[id] || !!assessmentData[currentRunId]?.[id]);
  }, [currentWorkbookIds, assessmentActivitiesDone, assessmentData, currentRunId]);

  const isAllParsingDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!parsingActivitiesDone[id] || !!parsingDataMap[id]);
  }, [currentWorkbookIds, parsingActivitiesDone, parsingDataMap, currentRunId]);

  const isAllMappingDone = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(id => !!mappingActivitiesDone[id]);
  }, [currentWorkbookIds, mappingActivitiesDone, currentRunId]);

  const stages = [
    { label: "Assessment", isDone: isAllAssessmentDone, isActive: !isAllAssessmentDone },
    { label: "Parsing", isDone: isAllParsingDone, isActive: isAllAssessmentDone && !isAllParsingDone },
    { label: "Mapping", isDone: isAllMappingDone, isActive: isAllParsingDone && hasContinued && !isAllMappingDone },
    { label: "Generation", isDone: !!generationActivitiesDone, isActive: isAllMappingDone && !generationActivitiesDone },
    { label: "Validation", isDone: !!validationActivitiesDone, isActive: generationActivitiesDone && !validationActivitiesDone }
  ];

  const currentStageIndex = stages.findIndex(s => s.isActive);
  const displayStage = stages[currentStageIndex] || (stages[stages.length - 1].isDone ? stages[stages.length - 1] : stages[0]);

  const projectMetrics = useMemo(() => {
    const metrics = { workbooks: 0, datasources: 0, tables: 0, measures: 0, lods: 0, dimensions: 0 };
    if (!currentRunId) return metrics;

    metrics.workbooks = currentWorkbookIds.length;

    currentWorkbookIds.forEach(id => {
      const payload = assessmentData[currentRunId]?.[id]?.payload || {};

      // Data source counts
      metrics.datasources += (payload.logical_datasources?.length || 0);

      // Table counts (Try parsing results first, then assessment fallback)
      const pData = parsingDataMap[id];
      if (pData?.tables && Array.isArray(pData.tables)) {
        metrics.tables += pData.tables.length;
      } else {
        const assessmentTables = (payload.tables_analysis?.total_tables || payload.tables_analysis?.total_count || 0);
        if (assessmentTables > 0) {
          metrics.tables += assessmentTables;
        } else if (payload.logical_datasources) {
          payload.logical_datasources.forEach((ds: any) => {
            metrics.tables += (ds.tables?.length || ds.tableCount || 0);
          });
        }
      }

      // LOD counts (Prefer parsing counts if available)
      const parsingLods = pData?.calculations?.filter((c: any) => c.is_lod).length || 0;
      const assessmentLods = payload.lods_analysis?.total_count || 0;
      metrics.lods += Math.max(parsingLods, assessmentLods);

      // Measures and Dimensions (Intelligent selection: use parsing if it's more comprehensive, fallback to assessment)
      const parsingMeasures = pData?.fields?.measures?.length || 0;
      const parsingDimensions = pData?.fields?.dimensions?.length || 0;

      if (parsingMeasures > 0 || parsingDimensions > 0) {
        metrics.measures += parsingMeasures;
        metrics.dimensions += parsingDimensions;
      } else if (payload.calculation_stats) {
        const stats = payload.calculation_stats;
        const total = stats.total_calculations || 0;
        const measures = stats.num_measures ?? Math.round((stats.pct_basic / 100) * total);
        const dimensions = stats.num_dimensions ?? (total - measures);

        metrics.measures += Math.max(0, measures);
        metrics.dimensions += Math.max(0, dimensions);
      }
    });

    return metrics;
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId]);

  const workbookMatrixData = useMemo(() => {
    if (!isPdfMode) return { data: [], avgRating: "Low" };

    let totalScore = 0;
    let count = 0;

    const data = currentWorkbookIds.map(id => {
      const payload = assessmentData[currentRunId || ""]?.[id]?.payload || {};
      const parsingData = parsingDataMap[id] || {};
      const entry = assessmentData[currentRunId || ""]?.[id] || {};

      const projectName = payload.project_name || entry.project_name || "Unknown Project";
      const workbookName = payload.workbook_name || entry.workbook_name || parsingData.workbook_name || id;

      const cleanDsName = (name: string) => {
        if (!name) return "Unknown";
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(name)) return "Unknown";
        let cleaned = name;
        if (cleaned.includes('http') || cleaned.includes('api.') || cleaned.includes('?')) {
          if (cleaned.toLowerCase().includes('weather')) return "Weather API";
          cleaned = "REST API";
        }
        cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
        cleaned = cleaned.replace(/_/g, ' ');
        return cleaned.trim();
      };

      const dataSourcesList = payload.logical_datasources?.map((ds: any) => cleanDsName(ds.name || ds.type || "Unknown")) || [];
      const primaryDataSource = dataSourcesList.length > 0 ? dataSourcesList[0] : "None";

      const compScore = payload.complexity?.complexity_score ?? 0;
      let rating = payload.complexity?.complexity_rating || payload.complexity?.category;
      if (!rating) {
        rating = compScore > 75 ? "High" : compScore > 40 ? "Medium" : "Low";
      }

      if (compScore > 0) {
        totalScore += compScore;
        count++;
      }

      return {
        projectName,
        workbookName,
        primaryDataSource,
        rating: String(rating),
      };
    });

    const avgScore = count > 0 ? totalScore / count : 0;
    const avgRating = avgScore > 75 ? "High" : avgScore > 40 ? "Medium" : "Low";

    return { data, avgRating };
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId, isPdfMode]);

  type AiGenerationState = 'idle' | 'waiting_for_assessment' | 'aggregating_portfolio' | 'preparing_ai_payload' | 'generating_ai' | 'completed' | 'error';
  const [aiGenerationState, setAiGenerationState] = useState<AiGenerationState>('idle');
  const [cachedInsights, setCachedInsights] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const isGeneratingInsights = aiGenerationState === 'generating_ai' || aiGenerationState === 'aggregating_portfolio' || aiGenerationState === 'preparing_ai_payload';

  const localInsightsData = useMemo(() => {
    if (currentWorkbookIds.length === 0) return null;

    // ─── Complexity buckets (based solely on complexity_score / rating) ───────
    let complexityLow = 0;
    let complexityMedium = 0;
    let complexityHigh = 0;

    // ─── Risk buckets (based on legacy_risks + technical_challenges) ──────────
    let riskLow = 0;
    let riskMedium = 0;
    let riskHigh = 0;

    // ─── Aggregate effort driver counts ──────────────────────────────────────
    let totalCustomSql = 0;
    let totalLods = 0;
    let totalCalculations = 0;
    let totalDatasources = 0;
    let totalWorksheets = 0;
    let totalDashboards = 0;

    // ─── Blocker frequency map ────────────────────────────────────────────────
    const blockerCounts: Record<string, number> = {};

    // ─── Per-workbook highlight tracking ─────────────────────────────────────
    let maxCompScore = -1; let maxCompName = "";
    let maxSqlCount = -1; let maxSqlName = "";
    let maxLodCount = -1; let maxLodName = "";
    let maxCalcCount = -1; let maxCalcName = "";
    let maxDsCount = -1; let maxDsName = "";
    let maxChallengesCount = -1; let maxChallengesName = "";

    // ─── Requires Attention items ─────────────────────────────────────────────
    const requiresAttention: { workbook: string; reason: string }[] = [];

    // ─── Key Findings ─────────────────────────────────────────────────────────
    let legacyWorkbookCount = 0;
    let sqlWorkbookCount = 0;

    currentWorkbookIds.forEach(id => {
      const payload = assessmentData[currentRunId || ""]?.[id]?.payload || {};
      const parsingData = parsingDataMap[id] || {};
      const entry = assessmentData[currentRunId || ""]?.[id] || {};

      const wbName = payload.workbook_name || entry.workbook_name || parsingData.workbook_name || "";
      if (!wbName || /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(wbName)) return;

      // Complexity
      const compScore = typeof payload.complexity?.complexity_score === 'number' ? payload.complexity.complexity_score : 0;
      let compRating: string = payload.complexity?.complexity_rating || payload.complexity?.category || "";
      if (!compRating) compRating = compScore > 75 ? "High" : compScore > 40 ? "Medium" : "Low";

      if (compRating === "High") complexityHigh++;
      else if (compRating === "Medium") complexityMedium++;
      else complexityLow++;

      // Risk (independent of complexity)
      const legacyRisk = !!(payload.legacy_risks?.is_legacy_detected || payload.legacy_risks?.has_legacy);
      const challenges: string[] = (payload.complexity?.technical_challenges || []).map((c: any) => typeof c === 'string' ? c : (c?.challenge || JSON.stringify(c)));
      const riskScore = (legacyRisk ? 2 : 0) + (challenges.length > 3 ? 2 : challenges.length > 0 ? 1 : 0);
      if (riskScore >= 3) riskHigh++;
      else if (riskScore >= 1) riskMedium++;
      else riskLow++;

      // Counts
      const sqlCount = payload.custom_sql_details?.length || payload.semantics?.custom_sql_count || 0;
      const lodCount = parsingData.calculations?.filter((c: any) => c.is_lod)?.length || payload.lods_analysis?.total_count || 0;
      const calcCount = parsingData.calculations?.length || payload.calculation_stats?.total_calculations || 0;
      const dsCount = payload.logical_datasources?.length || 0;
      const getCount = (val: any) => typeof val === 'number' ? val : val?.length || 0;
      const wsCount = getCount(parsingData.worksheets) || getCount(payload.worksheets);
      const dbCount = getCount(parsingData.dashboards) || getCount(payload.dashboards);

      totalCustomSql += sqlCount;
      totalLods += lodCount;
      totalCalculations += calcCount;
      totalDatasources += dsCount;
      totalWorksheets += wsCount;
      totalDashboards += dbCount;
      if (legacyRisk) legacyWorkbookCount++;
      if (sqlCount > 0) sqlWorkbookCount++;

      // Blockers
      challenges.forEach((c: string) => {
        if (c) blockerCounts[c] = (blockerCounts[c] || 0) + 1;
      });
      if (legacyRisk) blockerCounts["Legacy Features"] = (blockerCounts["Legacy Features"] || 0) + 1;

      // Highlights
      if (compScore > maxCompScore) { maxCompScore = compScore; maxCompName = wbName; }
      if (sqlCount > maxSqlCount) { maxSqlCount = sqlCount; maxSqlName = wbName; }
      if (lodCount > maxLodCount) { maxLodCount = lodCount; maxLodName = wbName; }
      if (calcCount > maxCalcCount) { maxCalcCount = calcCount; maxCalcName = wbName; }
      if (dsCount > maxDsCount) { maxDsCount = dsCount; maxDsName = wbName; }
      if (challenges.length > maxChallengesCount) { maxChallengesCount = challenges.length; maxChallengesName = wbName; }

      if (compRating === "High") requiresAttention.push({ workbook: wbName, reason: "High complexity — manual review recommended" });
      else if (legacyRisk) requiresAttention.push({ workbook: wbName, reason: "Legacy features detected — validation required" });
      else if (sqlCount > 0) requiresAttention.push({ workbook: wbName, reason: `Contains ${sqlCount} Custom SQL quer${sqlCount > 1 ? 'ies' : 'y'} — may need rework` });
    });

    const topBlockers = Object.entries(blockerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
    const primaryRiskDriver = topBlockers[0] || null;
    const totalWbs = complexityLow + complexityMedium + complexityHigh;

    const majorityComplexity = complexityHigh > (complexityLow + complexityMedium) ? "High" : (complexityLow > complexityMedium ? "Low" : "Medium");
    const migrationEffort = majorityComplexity === "High" ? "High" : majorityComplexity === "Medium" ? "Moderate" : "Low";

    const executiveSummary = `The selected migration portfolio contains ${totalWbs} workbook${totalWbs !== 1 ? 's' : ''} and ${totalDatasources} data source${totalDatasources !== 1 ? 's' : ''} spanning multiple business reporting domains. Assessment results indicate that the majority of assets fall within the ${majorityComplexity} complexity category, suggesting an overall migration profile of ${migrationEffort} effort. The estate demonstrates significant use of calculations, visualizations, and analytical constructs which will require validation during migration. ${totalCustomSql > 0 || totalLods > 0 || legacyWorkbookCount > 0 ? `Custom SQL logic, LOD expressions, legacy dependencies, or other technical challenges have been identified across selected assets and represent the primary migration considerations.` : `Standard data representations form the bulk of the portfolio, ensuring a smoother transition.`} Datasource consolidation patterns suggest opportunities for governance simplification and semantic model standardization. Risk analysis indicates that ${riskHigh > 0 ? `the highest migration effort is concentrated within a small subset of workbooks rather than the broader portfolio.` : `the estate is largely free of critical blockers.`} The overall estate appears suitable for phased migration execution with focused remediation activities for identified high-impact assets. Based on the assessment results, migration planning should prioritize foundational data model alignment before large-scale report migration activities.`;

    let recommendedApproach: string[] = [];

    // 1. Execution Strategy
    if (totalWbs === 1) {
      recommendedApproach.push(`Single-Asset Execution Strategy: Because this is an isolated migration, testing and semantic validation can be highly localized without cross-workbook dependency risks.`);
    } else if (complexityLow > (totalWbs * 0.7)) {
      recommendedApproach.push(`Low-Risk Accelerated Execution Strategy: The portfolio exhibits predominantly low complexity (${Math.round((complexityLow / totalWbs) * 100)}% of assets). Initiate a phased migration starting immediately with these low-risk workbooks to establish and refine deployment pipelines.`);
    } else if (complexityHigh > 0 && complexityLow > 0) {
      recommendedApproach.push(`Wave-Based Execution Strategy: The portfolio presents a mixed complexity profile. Categorize assets into distinct waves, prioritizing low-complexity workbooks in the initial phases to build momentum.`);
    } else {
      recommendedApproach.push(`Validation-Led Execution Strategy: The portfolio demonstrates a balanced profile without extreme outliers. Proceed with a standard phased approach, focusing on foundational data model alignment followed by iterative report validation.`);
    }

    // 2. Risk Mitigation Strategy
    if (topBlockers.length > 0 && topBlockers.includes("Legacy Features")) {
      recommendedApproach.push(`Remediation-First Risk Strategy: Unsupported or legacy dependencies were identified across the portfolio. It is strongly advised to undergo a prerequisite phase focused solely on refactoring these legacy elements into modern, supported architectures within Fabric.`);
    } else if (riskHigh > 0) {
      recommendedApproach.push(`Risk Containment Strategy: Elevated technical risk was detected across ${riskHigh} workbooks. Isolate high-risk workbooks into a dedicated migration wave for deep-dive technical analysis and proof-of-concept validation.`);
    } else {
      recommendedApproach.push(`Standard Risk Mitigation Strategy: No critical legacy blockers or high-risk features were detected. Employ standard quality assurance and testing procedures during the visualization migration phase.`);
    }

    // 3. Data Foundation Strategy
    if (totalCustomSql > totalWbs * 0.5) {
      recommendedApproach.push(`Datasource-First Foundation Strategy: Custom SQL usage was detected across ${totalCustomSql} queries. Unpack these queries and rebuild the logic natively within Fabric’s semantic models or upstream data engineering pipelines to improve maintainability.`);
    } else if (totalDatasources > 0 && totalDatasources < totalWbs * 0.5) {
      recommendedApproach.push(`Datasource Consolidation Foundation Strategy: A highly concentrated data architecture was detected, sharing just ${totalDatasources} underlying datasources. Prioritize the migration and certification of these core datasets first to establish a centralized semantic layer.`);
    } else {
      recommendedApproach.push(`Direct Data Foundation Strategy: The datasource to workbook ratio is well-balanced. Ensure that each data source is accurately mapped to its corresponding Fabric semantic model without requiring massive pre-consolidation efforts.`);
    }

    // 4. Analytics Modernization Strategy
    if (totalLods > totalWbs * 1.5) {
      recommendedApproach.push(`Semantic Model Modernization Strategy: Significant LOD expression usage (${totalLods} calculations) was detected. Reproduce and validate these complex calculations within Fabric's DAX or semantic layer before any UI components are moved.`);
    } else {
      recommendedApproach.push(`Visual Parity Modernization Strategy: Calculation density is moderate. Focus primarily on ensuring visualization parity and layout accuracy when transitioning from Tableau to the new environment.`);
    }

    // 5. Governance Strategy
    recommendedApproach.push(`Workspace Governance Strategy: Establish clear deployment pipelines, ownership alignment, and standardized semantic models across the ${totalWbs} workbooks to maintain order and security throughout the migration process.`);

    let rawFindings: string[] = [];

    rawFindings.push(`${totalWbs} workbook${totalWbs !== 1 ? 's' : ''} and ${totalWorksheets} worksheet${totalWorksheets !== 1 ? 's' : ''} were analyzed across the migration scope.`);

    const lowPct = totalWbs > 0 ? Math.round((complexityLow / totalWbs) * 100) : 0;
    if (lowPct > 50) {
      rawFindings.push(`${lowPct}% of assets are classified as Low Complexity, indicating strong migration readiness.`);
    } else {
      rawFindings.push(`The migration estate presents a mixed complexity profile, requiring structured testing and validation cycles.`);
    }

    if (totalCalculations > 0) {
      rawFindings.push(`Calculation density remains moderate with ${totalCalculations} calculation${totalCalculations !== 1 ? 's' : ''} identified across the selected scope.`);
    }

    if (totalCustomSql > 0) {
      rawFindings.push(`Custom SQL usage was detected across ${totalCustomSql} queries, which will require review for native query translation.`);
    }

    if (totalLods > 0) {
      rawFindings.push(`Complex LOD expressions were detected across ${totalLods} calculations, requiring careful semantic model mapping.`);
    }

    if (legacyWorkbookCount > 0) {
      rawFindings.push(`Legacy features were identified in ${legacyWorkbookCount} workbook${legacyWorkbookCount !== 1 ? 's' : ''}, representing the primary technical risk factor.`);
    }

    if (totalDatasources > 0) {
      rawFindings.push(`A total of ${totalDatasources} logical data sources power the portfolio, presenting consolidation opportunities.`);
    }

    if (riskHigh === 0 && complexityHigh === 0) {
      rawFindings.push("The overall estate demonstrates low migration risk with limited high-complexity assets.");
    }

    const keyFindings = rawFindings.slice(0, 8);

    return {
      totalWbs,
      // Complexity (structure of dataset)
      complexity: { low: complexityLow, medium: complexityMedium, high: complexityHigh },
      // Risk (legacy + technical challenge driven)
      risk: { low: riskLow, medium: riskMedium, high: riskHigh },
      // Effort drivers
      effortDrivers: { sql: totalCustomSql, lods: totalLods, calculations: totalCalculations, datasources: totalDatasources },
      // Blockers
      topBlockers,
      primaryRiskDriver,
      // Highlights (per-workbook extremes)
      highlights: [
        maxCompScore > 0 ? { label: "Highest Complexity", value: maxCompName, detail: `Score: ${Math.round(maxCompScore)}` } : null,
        maxSqlCount > 0 ? { label: "Most Custom SQL", value: maxSqlName, detail: `${maxSqlCount} quer${maxSqlCount !== 1 ? 'ies' : 'y'}` } : null,
        maxCalcCount > 0 ? { label: "Most Calculations", value: maxCalcName, detail: `${maxCalcCount} calc${maxCalcCount !== 1 ? 's' : ''}` } : null,
        maxLodCount > 0 ? { label: "Most LOD Expressions", value: maxLodName, detail: `${maxLodCount} LOD${maxLodCount !== 1 ? 's' : ''}` } : null,
        maxDsCount > 0 ? { label: "Most Datasources", value: maxDsName, detail: `${maxDsCount} source${maxDsCount !== 1 ? 's' : ''}` } : null,
        maxChallengesCount > 0 ? { label: "Most Technical Challenges", value: maxChallengesName, detail: `${maxChallengesCount} challenge${maxChallengesCount !== 1 ? 's' : ''}` } : null,
      ].filter(Boolean) as { label: string; value: string; detail: string }[],
      // Snapshot
      snapshot: {
        totalWorkbooks: totalWbs,
        totalDatasources,
        migrationReady: complexityLow,
        needsValidation: complexityMedium,
        needsReview: complexityHigh,
      },
      // Executive Summary & Findings
      executiveSummary,
      recommendedApproach,
      keyFindings,
      // Requires Attention
      requiresAttention: requiresAttention.slice(0, 5),
    };
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId]);

  const aiGenerationFiredForRun = React.useRef<string | null>(null);

  useEffect(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return;
    const cacheKey = `migration_ai_insights_${currentRunId}_v1`;

    // 1. Check cache immediately if we haven't fired for this run yet
    if (aiGenerationFiredForRun.current !== currentRunId) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setCachedInsights(JSON.parse(cached));
          setAiGenerationState('completed');
          aiGenerationFiredForRun.current = currentRunId;
          console.log(`[AI Insights Lifecycle] Cache Hit: ${cacheKey}`);
          return;
        }
      } catch(e) {}
    }

    // 2. Wait for Assessment
    if (!isAllAssessmentDone) {
      // Only update state if we are still idle or need to wait
      setAiGenerationState(prev => (prev === 'idle' || prev === 'waiting_for_assessment') ? 'waiting_for_assessment' : prev);
      return;
    }

    // 3. Fire AI Generation (Exactly once per run)
    if (aiGenerationFiredForRun.current !== currentRunId && localInsightsData) {
      aiGenerationFiredForRun.current = currentRunId;
      setAiGenerationState('aggregating_portfolio');
      console.log(`[AI Insights Lifecycle] Portfolio Aggregation Started for Run: ${currentRunId}`);

      // Run async generation outside the effect's cleanup cycle
      (async () => {
        // Intelligent token management & rich context
        const sortedIds = [...currentWorkbookIds].sort((a, b) => {
          const scoreA = assessmentData[currentRunId]?.[a]?.payload?.complexity?.complexity_score || 0;
          const scoreB = assessmentData[currentRunId]?.[b]?.payload?.complexity?.complexity_score || 0;
          return scoreB - scoreA;
        });

        const detailedLimit = 15;
        const detailedIds = sortedIds.slice(0, detailedLimit);
        
        const workbookDetails = detailedIds.map(id => {
          const payload = assessmentData[currentRunId]?.[id]?.payload || {};
          const pData = parsingDataMap[id] || {};
          return {
            name: payload.workbook_name || id,
            complexityRating: payload.complexity?.complexity_rating || "Medium",
            complexityScore: payload.complexity?.complexity_score || 0,
            legacyRisk: payload.legacy_risks?.has_legacy || false,
            customSql: payload.custom_sql_details?.length || 0,
            lods: pData.calculations?.filter((c:any) => c.is_lod)?.length || payload.lods_analysis?.total_count || 0,
            challenges: (payload.complexity?.technical_challenges || []).map((c: any) => typeof c === 'string' ? c : c?.challenge),
            hasParsingData: !!parsingDataMap[id],
            hasMappingData: !!mappingActivitiesDone[id]
          };
        });

        const aiPayload = {
          portfolioTotals: {
            totalWorkbooks: localInsightsData.totalWbs,
            complexity: localInsightsData.complexity,
            risk: localInsightsData.risk,
            effortDrivers: localInsightsData.effortDrivers,
            topBlockers: localInsightsData.topBlockers
          },
          workbookDetails,
          truncatedWorkbooksCount: Math.max(0, currentWorkbookIds.length - detailedLimit)
        };

        const estimatedSize = JSON.stringify(aiPayload).length;
        console.log(`[AI Insights Lifecycle] Portfolio Aggregation Completed. Estimated Prompt Size: ${estimatedSize} chars`);

        setAiGenerationState('generating_ai');
        
        try {
          console.log(`[AI Insights Lifecycle] AI Generation Started`);
          const startTime = Date.now();
          const res = await fetch('/api/generate-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(aiPayload)
          });

          if (!res.ok) {
            throw new Error(`Azure OpenAI Error: ${res.status}`);
          }
          const data = await res.json();
          
          console.log(`[AI Insights Lifecycle] AI Generation Completed in ${Date.now() - startTime}ms`);
          
          setCachedInsights(data);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) { }
          setAiGenerationState('completed');
        } catch (err: any) {
          console.error(`[AI Insights Lifecycle] Error:`, err);
          setAiError(err.message);
          setAiGenerationState('error');
          aiGenerationFiredForRun.current = null; // Allow retry to work
        }
      })();
    }
  }, [currentRunId, currentWorkbookIds, isAllAssessmentDone, localInsightsData, assessmentData, parsingDataMap, mappingActivitiesDone]);

  const executiveInsightsData = useMemo(() => {
    if (!localInsightsData) return null;

    const effectiveSummary = cachedInsights?.executiveSummary || localInsightsData.executiveSummary;
    const effectiveFindings = cachedInsights?.keyFindings || localInsightsData.keyFindings;
    const effectiveApproach = cachedInsights?.recommendedApproach
      ? cachedInsights.recommendedApproach.map((r: any) => `${r.title}: ${r.narrative}`)
      : localInsightsData.recommendedApproach;

    return {
      ...localInsightsData,
      executiveSummary: effectiveSummary,
      keyFindings: effectiveFindings,
      recommendedApproach: effectiveApproach
    };
  }, [localInsightsData, cachedInsights]);

  const handleRetryAi = useCallback(() => {
    setAiError(null);
    setAiGenerationState('idle');
    aiGenerationFiredForRun.current = null;
  }, []);

  const challengesSummaryData = useMemo(() => {
    let totalCustomSql = 0;
    let totalLods = 0;
    let totalCalculations = 0;
    let totalParameters = 0;
    let totalLogicalSources = 0;
    let legacyDetectedCount = 0;
    let sumComplexityScore = 0;
    let countComplexityScore = 0;

    let minComplexity = Infinity;
    let minWbName = "";
    let maxComplexity = -Infinity;
    let maxWbName = "";

    const allChallenges = new Set<string>();

    const workbookLevelData: {
      name: string;
      rating: string;
      challenges: string[];
    }[] = [];

    currentWorkbookIds.forEach(id => {
      const wbName = assessmentData[currentRunId || ""]?.[id]?.workbook_name
        || assessmentData[currentRunId || ""]?.[id]?.payload?.workbook_name
        || parsingDataMap[id]?.workbook_name
        || id;

      const payload = assessmentData[currentRunId || ""]?.[id]?.payload || {};
      const parsingData = parsingDataMap[id] || {};

      // Extract Metrics
      const customSql = payload.custom_sql_details?.length || payload.semantics?.custom_sql_count || 0;
      totalCustomSql += customSql;

      const lods = parsingData.calculations?.filter((c: any) => c.is_lod)?.length || payload.lods_analysis?.total_count || 0;
      totalLods += lods;

      const calculations = parsingData.calculations?.length || payload.calculation_stats?.total_calculations || 0;
      totalCalculations += calculations;

      const parameters = payload.parameters?.length || 0;
      totalParameters += parameters;

      const logicalSources = payload.logical_datasources?.length || 0;
      totalLogicalSources += logicalSources;

      const hasLegacy = payload.legacy_risks?.is_legacy_detected || payload.legacy_risks?.has_legacy || false;
      if (hasLegacy) legacyDetectedCount++;

      const compScore = payload.complexity?.complexity_score;
      if (typeof compScore === 'number') {
        sumComplexityScore += compScore;
        countComplexityScore++;
        if (compScore < minComplexity) { minComplexity = compScore; minWbName = wbName; }
        if (compScore > maxComplexity) { maxComplexity = compScore; maxWbName = wbName; }
      }

      let rating = payload.complexity?.complexity_rating || payload.complexity?.category;
      if (!rating) {
        const s = compScore || 0;
        rating = s > 75 ? "High" : s > 40 ? "Medium" : "Low";
      }

      const challenges: string[] = (payload.complexity?.technical_challenges || []).map((c: any) => typeof c === 'string' ? c : (c?.challenge || JSON.stringify(c)));
      challenges.forEach((c: string) => allChallenges.add(c));

      workbookLevelData.push({
        name: wbName,
        rating: String(rating),
        challenges
      });
    });

    const avgScore = countComplexityScore > 0 ? Math.round(sumComplexityScore / countComplexityScore) : 0;
    const overallRating = avgScore > 75 ? "High" : avgScore > 40 ? "Medium" : "Low";

    const hasSignificantMetrics = totalCustomSql > 0 || totalLods > 0 || legacyDetectedCount > 0 || allChallenges.size > 0;

    // Dynamic Impact & Recommendations
    const recommendations = [];
    if (totalCustomSql > 0) {
      recommendations.push({ issue: "Custom SQL", impact: "Bypasses native optimizations and may not translate 1:1.", action: "Rebuild Custom SQL logic natively within the destination platform's data layer." });
    }
    if (totalLods > 0) {
      recommendations.push({ issue: "LOD Expressions", impact: "Heavily impact calculation granularity.", action: "Validate the aggregation context to ensure data consistency post-migration." });
    }
    if (legacyDetectedCount > 0) {
      recommendations.push({ issue: "Legacy Risks", impact: "Unsupported legacy features detected.", action: "Review legacy connections and update to supported architectures before migrating." });
    }

    return {
      totalCustomSql, totalLods, totalCalculations, totalParameters, totalLogicalSources,
      legacyDetectedCount, sumComplexityScore, countComplexityScore, minComplexity,
      minWbName, maxComplexity, maxWbName, allChallenges, workbookLevelData,
      avgScore, overallRating, hasSignificantMetrics, recommendations
    };
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId]);

  const migrationSummaryData = useMemo(() => {
    return currentWorkbookIds.map(id => {
      const payload = assessmentData[currentRunId || ""]?.[id]?.payload || {};
      const parsingData = parsingDataMap[id] || {};
      const entry = assessmentData[currentRunId || ""]?.[id] || {};
      const genData = locGenerationData[id];

      const workbookName = payload.workbook_name || entry.workbook_name || parsingData.workbook_name || id;
      const projectName = payload.project_name || entry.project_name || "Unknown Project";

      const cleanDsName = (name: string) => {
        if (!name) return "Unknown";
        if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(name)) return "Unknown";
        let cleaned = name;
        if (cleaned.includes('http') || cleaned.includes('api.') || cleaned.includes('?')) {
          if (cleaned.toLowerCase().includes('weather')) return "Weather API";
          cleaned = "REST API";
        }
        cleaned = cleaned.replace(/\s*\([^)]*\)/g, '');
        cleaned = cleaned.replace(/_/g, ' ');
        return cleaned.trim();
      };

      // 1. Gather all unique types from detailed_connections
      const detailedConnections = payload.detailed_connections || [];
      const connectionTypes = new Set<string>();

      detailedConnections.forEach((conn: any) => {
        const attrs = conn["@attributes"] || conn.attributes || {};
        const typeVal = conn.type || conn.Type || conn.connection_type || conn.class || attrs.class || attrs.type;
        if (typeVal && typeVal !== "NA") {
          connectionTypes.add(typeVal.toLowerCase());
        }
      });

      let typeArray = Array.from(connectionTypes);

      // 2. Fallback to database_sources if detailed_connections didn't yield any types
      if (typeArray.length === 0) {
        const dbSources = payload.database_sources || [];
        dbSources.forEach((src: any) => {
          if (typeof src === 'string') {
            connectionTypes.add(src.toLowerCase());
          } else {
            const typeVal = src.type || src.connection_type || src.Type || src.class;
            if (typeVal) connectionTypes.add(typeVal.toLowerCase());
          }
        });
        typeArray = Array.from(connectionTypes);
      }

      // 3. Fallback to logical_datasources names if absolutely no type metadata is found
      if (typeArray.length === 0) {
        const dataSourcesList = payload.logical_datasources?.map((ds: any) => cleanDsName(ds.name || ds.type || "Unknown")) || [];
        typeArray = Array.from(new Set(dataSourcesList));
      }

      const tableauDsRaw = typeArray.length > 0 ? typeArray.join(", ") : "N/A";
      let tableauDs: React.ReactNode = tableauDsRaw;

      const fabricWorkspace = genData?.project?.workspace_name || payload.workspace_name || entry.workspace_name || payload.fabric_workspace || selectedWorkspaceName || "Default Workspace";
      const fabricDs = "Semantic Model";

      let status = "Pending";
      if (validationActivitiesDone?.[id]) status = "Validated";
      else if (generationActivitiesDone?.[id]) status = "Generated";
      else if (mappingActivitiesDone?.[id]) status = "Mapped";
      else if (parsingActivitiesDone?.[id] || parsingDataMap[id]) status = "Parsed";
      else if (assessmentActivitiesDone?.[id] || assessmentData[currentRunId || ""]?.[id]) status = "Assessed";

      return { id, workbookName, projectName, tableauDs, tableauDsRaw, fabricWorkspace, fabricDs, status };
    }).filter(item => {
      // Filter out invalid or incomplete workbook metadata
      if (!item.workbookName || item.workbookName.trim() === "") return false;
      if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(item.workbookName)) return false;
      if (!item.tableauDsRaw || item.tableauDsRaw.trim() === "" || item.tableauDsRaw === "N/A") return false;
      if (item.status === "Pending") return false; // Assessment metadata not available
      return true;
    });
  }, [currentWorkbookIds, assessmentData, parsingDataMap, currentRunId, locGenerationData, selectedWorkspaceName, validationActivitiesDone, generationActivitiesDone, mappingActivitiesDone, parsingActivitiesDone]);

  // Download PDF handler — calls back to parent (MigrationTab) which owns
  // PdfReportRenderer so the minimized widget survives sub-tab navigation.
  const handleDownloadPDF = useCallback(() => {
    onRequestPdf?.()
  }, [onRequestPdf])

  const IntelligenceTile = ({ label, value, icon }: any) => (
    <Card className="vl-metric-card" style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div className="vl-metric-label">{label}</div>
        <div className={styles.tileIcon}>{icon}</div>
      </div>
      <div className="vl-metric-value">{value}</div>
    </Card>
  );

  return (
    <div className={styles.container} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
      {isPdfMode && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", padding: "0 8px", borderBottom: "2px solid #e2e8f0", paddingBottom: "16px" }}>
          <img src={typeof window !== 'undefined' ? `${window.location.origin}/VectorLab_Logo.png` : "/VectorLab_Logo.png"} alt="VectorLab Logo" style={{ height: "64px", objectFit: "contain" }} />
          <div style={{ textAlign: "right", fontSize: "16px", color: "#64748b", marginTop: "12px" }}>
            <div><strong>Generated At:</strong> {new Date().toLocaleString()}</div>
          </div>
        </div>
      )}
      <div className={styles.headerActionsContainer}>
        <div className="vl-header">
          <div className="vl-title" style={isPdfMode ? { fontSize: "32px", fontWeight: "bold", marginBottom: "16px" } : {}}>Migration Overview</div>
          {!isPdfMode && (
            <div className="vl-subtitle">
              Strategic analysis of your migration project. Key metrics across all {currentWorkbookIds.length} workbook{currentWorkbookIds.length !== 1 ? 's' : ''}.
            </div>
          )}
        </div>
        {!isPdfMode && isAllParsingDone && (
          <Button
            icon={isGeneratingInsights ? <Spinner size="extra-tiny" /> : <DocumentPdf24Regular />}
            appearance="primary"
            size="large"
            disabled={isGeneratingInsights}
            onClick={handleDownloadPDF}
            className={styles.downloadButton}
            title={isGeneratingInsights ? "Waiting for AI insights..." : "Download migration report as PDF"}
          >
            {isGeneratingInsights ? "Generating Insights..." : "Download Report"}
          </Button>
        )}
      </div>



      {isPdfMode && (
        <div style={{ marginBottom: "48px", display: "flex", alignItems: "stretch", justifyContent: "center", gap: "24px", padding: "0 8px", breakInside: "avoid", pageBreakInside: "avoid" }}>

          {/* Source Card */}
          <div style={{ flex: 1, backgroundColor: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", padding: "24px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
            <div style={{ color: "#1e40af", fontWeight: 600, fontSize: "18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src="https://img.icons8.com/?size=100&id=9Kvi1p1F0tUo&format=png&color=000000" alt="Tableau" width={32} height={32} />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "16px" }}>Source</span>
                <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: "normal" }}>Tableau Environment</span>
              </div>
            </div>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "6px", padding: "16px", border: "1px solid #e2e8f0", flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: tokens.colorNeutralForeground1, marginBottom: "8px" }}>
                {siteNames.length > 0 ? siteNames[0] : "vectorlab"}
              </div>
              <div style={{ fontSize: "14px", color: tokens.colorNeutralForeground2, display: "flex", flexDirection: "column", gap: "4px" }}>
                <span>{projectNames.length > 0 ? projectNames.join(', ') : selectedProjectName || "Project"}</span>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ color: "#64748b", display: "flex", alignItems: "center", padding: "0 16px" }}>
            <ArrowRight24Regular primaryFill="#64748b" />
          </div>

          {/* Target Card */}
          <div style={{ flex: 1, backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0", padding: "24px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
            <div style={{ color: "#166534", fontWeight: 600, fontSize: "18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
              <img src="/Fabric_Color_48.svg" alt="Fabric" width={32} height={32} />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "16px" }}>Target</span>
                <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "normal" }}>Microsoft Fabric</span>
              </div>
            </div>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "6px", padding: "16px", border: "1px solid #e2e8f0", flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: tokens.colorNeutralForeground1, marginBottom: "8px" }}>
                Target Fabric Workspace
              </div>
              <div style={{ fontSize: "14px", color: tokens.colorNeutralForeground2 }}>
                {workspaceNames.length > 0 ? workspaceNames[0] : selectedWorkspaceName || "Workspace"}
              </div>
            </div>
          </div>

        </div>
      )}

      <div className={styles.heroBanner} style={isPdfMode ? { backgroundColor: "#ffffff" } : {}}>
        <div className={styles.intelligenceGrid}>
          <IntelligenceTile label="Workbooks" value={projectMetrics.workbooks} icon={<DocumentDatabase24Regular />} />
          <IntelligenceTile label="Data Sources" value={projectMetrics.datasources} icon={<DatabaseSearch24Regular />} />
          <IntelligenceTile label="Logical Tables" value={projectMetrics.tables} icon={<Table24Regular />} />
          <IntelligenceTile label="Measures" value={projectMetrics.measures} icon={<Layer24Regular />} />
          <IntelligenceTile label="Dimensions" value={projectMetrics.dimensions} icon={<Settings24Regular />} />
          <IntelligenceTile label="LOD" value={projectMetrics.lods} icon={<BrainCircuit24Regular />} />
        </div>
      </div>

      {/* EXECUTIVE SUMMARY ONLY */}
      {((executiveInsightsData && executiveInsightsData.totalWbs > 0) || (isGeneratingInsights && !isPdfMode)) && (
        <div style={{ padding: "0 8px", marginTop: "32px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Executive Summary
            </div>
            <div style={{ fontSize: "15px", color: "#334155", lineHeight: "1.6", fontWeight: 500, backgroundColor: "#f8faff", padding: "20px", borderRadius: "10px", border: "1px solid #bfdbfe", borderLeft: "4px solid #3b82f6", minHeight: "64px", display: "flex", alignItems: "center" }}>
              {(aiGenerationState !== 'completed' && aiGenerationState !== 'error') && !isPdfMode ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#64748b" }}>
                  <Spinner size="extra-tiny" /> {aiGenerationState === 'waiting_for_assessment' ? 'Waiting for Assessment completion...' : 'Generating executive summary...'}
                </div>
              ) : (
                executiveInsightsData?.executiveSummary
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT COUNTS */}
      <div style={{ padding: "0 8px", marginTop: "32px", marginBottom: "32px" }}>
        <Card
          style={{
            backgroundColor: tokens.colorNeutralBackground1,
            padding: "32px",
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            boxShadow: tokens.shadow8,
            borderRadius: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "24px"
          }}
        >
          <SectionHeading title="Content Counts" description="Detailed breakdown of key migration metrics and elements discovered during assessment." />

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "15px", borderRadius: "8px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                  <th style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "16px", color: tokens.colorNeutralForeground1 }}>Metric</th>
                  <th style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontSize: "16px", color: tokens.colorNeutralForeground1, width: "120px" }}>Count</th>
                </tr>
              </thead>
              <tbody style={{ backgroundColor: "#ffffff" }}>
                <tr>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground2 }}>Custom SQL Queries</td>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontWeight: 600 }}>{challengesSummaryData.totalCustomSql}</td>
                </tr>
                <tr>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground2 }}>LOD Expressions</td>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontWeight: 600 }}>{challengesSummaryData.totalLods}</td>
                </tr>
                <tr>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground2 }}>Parameters</td>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontWeight: 600 }}>{challengesSummaryData.totalParameters}</td>
                </tr>
                <tr>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground2 }}>Logical Data Sources</td>
                  <td style={{ padding: "16px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontWeight: 600 }}>{challengesSummaryData.totalLogicalSources}</td>
                </tr>
                <tr>
                  <td style={{ padding: "16px", color: tokens.colorNeutralForeground2 }}>Workbooks w/ Legacy Risks</td>
                  <td style={{ padding: "16px", fontWeight: 600 }}>{challengesSummaryData.legacyDetectedCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>



      <div style={{ padding: "0 8px" }}>
        {/* NEW Source System Inventory TABLE */}
        <div className="pdf-section" style={{ breakInside: "auto", pageBreakInside: "auto", marginBottom: "32px" }}>
          <SectionHeading title="Source System Inventory" />
          <div style={{ overflowX: "auto" }}>
            {migrationSummaryData.length > 0 ? (
              <Table aria-label="Source System Inventory Table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", fontSize: "14px", pageBreakInside: "auto" }}>
                <TableHeader style={{ breakInside: "avoid" }}>
                  <TableRow style={{ background: "#f1f5f9", textAlign: "left", breakInside: "avoid" }}>
                    <TableHeaderCell style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontWeight: "bold" }}>Workbook Name</TableHeaderCell>
                    <TableHeaderCell style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", fontWeight: "bold" }}>Tableau Data Sources</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {migrationSummaryData.map((item) => (
                    <TableRow key={item.id} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                      <TableCell style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word" }}><Text weight="semibold">{item.workbookName}</Text></TableCell>
                      <TableCell style={{ padding: "10px", borderBottom: "1px solid #e2e8f0", wordBreak: "break-word" }}>{item.tableauDs}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div style={{ padding: "32px", color: tokens.colorNeutralForeground3, fontStyle: "italic", textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc" }}>
                Workbook metadata will appear after assessment is completed.
              </div>
            )}
          </div>
        </div>

        <OnlyAssessmentTab isPdfMode={isPdfMode}>
          {isPdfMode && (
            <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "48px", padding: "0 8px", pageBreakInside: "auto" }}>
              {/* CHALLENGES SUMMARY SECTION */}
              <div className="pdf-section" style={{ breakInside: "auto", pageBreakInside: "auto" }}>
                <SectionHeading title="Migration Challenges Summary" />
                <div style={{ display: "flex", flexDirection: "column", gap: "32px", fontSize: "15px", color: tokens.colorNeutralForeground1 }}>
                  {(() => {
                    const {
                      totalCustomSql, totalLods, totalCalculations, totalParameters, totalLogicalSources,
                      legacyDetectedCount, minComplexity, minWbName, maxComplexity, maxWbName,
                      workbookLevelData, avgScore, overallRating, hasSignificantMetrics, recommendations, countComplexityScore
                    } = challengesSummaryData;

                    if (!hasSignificantMetrics && countComplexityScore === 0) {
                      return <div style={{ fontStyle: "italic", padding: "16px" }}>No significant migration challenges detected based on assessment results.</div>;
                    }

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                        {/* A. Overall Assessment */}
                        {!isPdfMode && (
                          <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                            <strong style={{ fontSize: "20px", display: "block", marginBottom: "16px" }}>Overall Assessment</strong>
                            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", background: "#f8fafc", padding: "16px", borderRadius: "8px", fontSize: "16px", lineHeight: "1.6" }}>
                              <div><span style={{ color: tokens.colorNeutralForeground3 }}>Average Complexity:</span> <strong>{avgScore} ({overallRating})</strong></div>
                              {maxWbName && <div><span style={{ color: tokens.colorNeutralForeground3 }}>Highest Complexity:</span> <strong>{maxWbName} ({maxComplexity})</strong></div>}
                              {minWbName && minWbName !== maxWbName && <div><span style={{ color: tokens.colorNeutralForeground3 }}>Lowest Complexity:</span> <strong>{minWbName} ({minComplexity})</strong></div>}
                            </div>
                          </div>
                        )}

                        {/* C. Workbook-Level Challenges Table */}
                        <div style={{ breakInside: "auto", pageBreakInside: "auto" }}>
                          <strong style={{ fontSize: "20px", display: "block", marginBottom: "16px", pageBreakAfter: "avoid" }}>Workbook-Level Summary</strong>
                          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #e2e8f0", tableLayout: "fixed" }}>
                            <thead>
                              <tr style={{ background: "#f1f5f9", textAlign: "left", breakInside: "avoid" }}>
                                <th style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", width: "30%", fontSize: "16px" }}>Workbook Name</th>
                                <th style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", width: "15%", fontSize: "16px" }}>Rating</th>
                                <th style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", width: "55%", fontSize: "16px" }}>Detected Challenges</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workbookLevelData.map((wb, i) => (
                                <tr key={i} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                                  <td style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top", fontSize: "15px", fontWeight: 600, wordBreak: "break-word" }}>{wb.name}</td>
                                  <td style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top", fontSize: "15px" }}>{wb.rating}</td>
                                  <td style={{ padding: "16px", borderBottom: "1px solid #e2e8f0", verticalAlign: "top", fontSize: "15px", lineHeight: "1.6" }}>
                                    {wb.challenges.length > 0 ? (
                                      <ul style={{ margin: 0, paddingLeft: "20px" }}>
                                        {wb.challenges.map((c, idx) => <li key={idx} style={{ marginBottom: "8px" }}>{c}</li>)}
                                      </ul>
                                    ) : <span style={{ color: tokens.colorNeutralForeground3 }}>None</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* D. Recommended Actions */}
                        {recommendations.length > 0 && (
                          <div style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
                            <strong style={{ fontSize: "20px", display: "block", marginBottom: "16px", pageBreakAfter: "avoid" }}>Migration Impact & Recommendations</strong>
                            <ul style={{ margin: "0 0 0 24px", fontSize: "15px", lineHeight: "1.6" }}>
                              {recommendations.map((rec, i) => (
                                <li key={i} style={{ marginBottom: "16px" }}>
                                  <strong>{rec.issue}:</strong> {rec.impact} <br />
                                  <em>Action:</em> <span style={{ color: tokens.colorNeutralForeground3 }}>{rec.action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </OnlyAssessmentTab>

        {((executiveInsightsData && executiveInsightsData.totalWbs > 0) || (isGeneratingInsights && !isPdfMode)) && (() => {
          const ei = executiveInsightsData || { recommendedApproach: [], keyFindings: [], executiveSummary: "", totalWbs: 0 };
          return (
            <Card
              style={{
                backgroundColor: isPdfMode ? "#ffffff" : tokens.colorNeutralBackground1,
                padding: isPdfMode ? "0" : "32px",
                border: isPdfMode ? "none" : `1px solid ${tokens.colorNeutralStroke2}`,
                boxShadow: isPdfMode ? "none" : tokens.shadow8,
                borderRadius: isPdfMode ? "0" : "16px",
                breakInside: "avoid",
                pageBreakInside: "avoid",
                display: "flex",
                flexDirection: "column",
                gap: "24px"
              }}
            >
              <SectionHeading title="Migration Executive Insights" description="Portfolio-level executive summary and key findings generated dynamically by AI based on assessment telemetry." />

              <div style={{ display: "flex", flexDirection: "column", gap: "32px", position: "relative" }}>
                {aiError && (
                  <div style={{ padding: "16px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", border: "1px solid #fecaca", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>AI Generation Failed:</strong> {aiError}. Falling back to rules-based insights.
                    </div>
                    {!isPdfMode && (
                      <Button appearance="outline" onClick={handleRetryAi}>Retry</Button>
                    )}
                  </div>
                )}

                {(((aiGenerationState !== 'completed' && aiGenerationState !== 'error') && !isPdfMode) || (ei.recommendedApproach && ei.recommendedApproach.length > 0)) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Recommended Approach
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {(aiGenerationState !== 'completed' && aiGenerationState !== 'error') && !isPdfMode ? (
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", backgroundColor: "#f0fdf4", padding: "16px 20px", borderRadius: "10px", border: "1px solid #bbf7d0", color: "#64748b" }}>
                          <Spinner size="extra-tiny" /> Preparing AI recommendations...
                        </div>
                      ) : (
                        ei.recommendedApproach.map((f: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", backgroundColor: "#f0fdf4", padding: "16px 20px", borderRadius: "10px", border: "1px solid #bbf7d0", breakInside: "avoid", pageBreakInside: "avoid" }}>
                            <span style={{ color: "#10b981", fontWeight: "700", flexShrink: 0, marginTop: "2px", fontSize: "18px" }}>•</span>
                            <span style={{ fontSize: "15px", color: "#334155", lineHeight: "1.6", fontWeight: 500, width: "100%" }}>
                              {(() => {
                                const firstColonIdx = f.indexOf(':');
                                if (firstColonIdx > -1) {
                                  const title = f.substring(0, firstColonIdx).trim();
                                  const content = f.substring(firstColonIdx + 1).trim();
                                  const obsMatch = content.match(/Observation:\s*(.*?)(?=Impact:|Recommended Action:|$)/i);
                                  const impMatch = content.match(/Impact:\s*(.*?)(?=Observation:|Recommended Action:|$)/i);
                                  const recMatch = content.match(/Recommended Action:\s*(.*?)(?=Observation:|Impact:|$)/i);

                                  if (obsMatch || impMatch || recMatch) {
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <strong style={{ textTransform: "uppercase" }}>{title}:</strong>
                                        <ul style={{ margin: "0 0 0 20px", padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
                                          {obsMatch && <li><strong>Observation:</strong> {obsMatch[1].trim()}</li>}
                                          {impMatch && <li><strong>Impact:</strong> {impMatch[1].trim()}</li>}
                                          {recMatch && <li><strong>Recommended Action:</strong> {recMatch[1].trim()}</li>}
                                        </ul>
                                      </div>
                                    );
                                  }
                                  return (
                                    <>
                                      <strong style={{ textTransform: "uppercase" }}>{title}:</strong> {content}
                                    </>
                                  );
                                }
                                return f;
                              })()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {(((aiGenerationState !== 'completed' && aiGenerationState !== 'error') && !isPdfMode) || (ei.keyFindings && ei.keyFindings.length > 0)) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "600", color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Key Findings
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {(aiGenerationState !== 'completed' && aiGenerationState !== 'error') && !isPdfMode ? (
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", backgroundColor: "#f8fafc", padding: "16px 20px", borderRadius: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>
                          <Spinner size="extra-tiny" /> Analyzing migration portfolio...
                        </div>
                      ) : (
                        ei.keyFindings.map((f: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", backgroundColor: "#f8fafc", padding: "16px 20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                            <span style={{ color: "#3b82f6", fontWeight: "700", flexShrink: 0, marginTop: "2px", fontSize: "18px" }}>•</span>
                            <span style={{ fontSize: "15px", color: "#334155", lineHeight: "1.6", fontWeight: 500 }}>{f}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })()}
      </div>

    </div>
  )
}
