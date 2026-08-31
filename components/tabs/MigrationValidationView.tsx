import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
    ChevronRight,
    X,
    CheckCircle2,
    BrainCircuit,
    ChevronDown,
    ChevronUp,
    Table as TableIcon,
    ClipboardList,
    Info,
    Database,
    Link as LinkIcon,
    Calculator,
    ShieldCheck,
    MousePointerClick,
    Code,
    Filter,
    Settings,
    PlugZap,
    Shapes,
    PieChart,
    RefreshCw,
    ChevronLeft,
} from "lucide-react";
import { useValidationStore } from "@/stores/validation.store";
import { useAuthStore } from "@/stores/auth.store";
import { ENABLE_RERUN_VALIDATION } from "@/lib/featureFlags";
import { useState, useRef } from "react";

import { T, useGlobalStyles, useFluentStyles } from "./migration-validation/styles";
import { TechnicalContent } from "./migration-validation/TechnicalContent";
import { NameReconciliationTable } from "./migration-validation/NameReconciliationTable";

const WEIGHT_MAP: Record<string, number> = { regular: 400, medium: 500, semibold: 600, bold: 700 };
const SIZE_MAP: Record<number, number> = { 100: 10, 200: 12, 300: 14, 400: 16, 500: 20, 600: 24, 700: 28, 800: 32, 900: 40, 1000: 68 };

/** Early-exit threshold for the best-candidate heuristic search below. */
const EXCELLENT_MATCH_SCORE = 60;

function Text({
    weight,
    size,
    italic,
    style,
    ...props
}: { weight?: "regular" | "medium" | "semibold" | "bold"; size?: number; italic?: boolean } & React.HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            style={{
                fontWeight: weight ? WEIGHT_MAP[weight] : undefined,
                fontSize: size ? `${SIZE_MAP[size]}px` : undefined,
                fontStyle: italic ? "italic" : undefined,
                ...style,
            }}
            {...props}
        />
    );
}



interface MigrationValidationViewProps {
    status: string;
    migrationData: any;
    extractionStatus?: string;
    workbookId?: string;
    runId?: string;
    projectId?: string;
}

/**
 * MigrationValidationView - Premium scorecard and detail view for 
 * Tableau to Power BI migration validation results.
 */
export function MigrationValidationView({ status, migrationData, extractionStatus, workbookId, runId, projectId }: MigrationValidationViewProps) {
    const styles = useGlobalStyles();
    const fluentStyles = useFluentStyles();

    const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [debugOpen, setDebugOpen] = useState(false);
    const [isRevalidating, setIsRevalidating] = useState(false);
    const [revalidationSuccessOpen, setRevalidationSuccessOpen] = useState(false);
    const [isRefreshingValidationResults, setIsRefreshingValidationResults] = useState(false);
    // Ref to track the animation cleanup timer — prevents stacking on repeated re-runs
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const triggerSingleValidation = useValidationStore(s => s.triggerSingleValidation);
    const userEmail = useAuthStore(s => s.user?.email);

    const handleRerunValidation = async () => {
        // Resolve IDs from props or fallback to migrationData payload
        const activeWorkbookId = workbookId || migrationData?.workbookId || migrationData?.workbook_id;
        const activeRunId = runId || migrationData?.runId || migrationData?.run_id;
        const activeProjectId = projectId || migrationData?.projectId || migrationData?.project_id;

        if (!activeWorkbookId || !activeRunId || !activeProjectId || !userEmail) {
            const missing = [];
            if (!activeWorkbookId) missing.push("Workbook ID");
            if (!activeRunId) missing.push("Run ID");
            if (!activeProjectId) missing.push("Project ID");
            if (!userEmail) missing.push("User Email");
            
            console.error("[Rerun] Missing data:", { activeWorkbookId, activeRunId, activeProjectId, userEmail });
            alert(`Cannot re-run validation. Missing: ${missing.join(", ")}`);
            return;
        }
        
        try {
            setIsRevalidating(true);
            const response = await triggerSingleValidation(userEmail, activeRunId, activeProjectId, activeWorkbookId);
            
            const data = response?.data || response;
            if (data?.failed_count > 0 && Array.isArray(data?.workbook_statuses)) {
                // Find the failure for this workbook, or just the first failure if not found
                const failedStatus = data.workbook_statuses.find((s: any) => s.workbook_id === activeWorkbookId && s.status === 'failed') || 
                                     data.workbook_statuses.find((s: any) => s.status === 'failed');
                
                if (failedStatus && failedStatus.error_message) {
                    alert(`Validation Warning:\n\n${failedStatus.error_message}`);
                    setIsRevalidating(false);
                    return; // Stop polling, allow user to trigger again
                }
            }
            
            if (data?.project_workbooks_status) {
                for (const pid in data.project_workbooks_status) {
                    const statuses = data.project_workbooks_status[pid];
                    if (Array.isArray(statuses)) {
                        const failedStatus = statuses.find((s: any) => s.workbook_id === activeWorkbookId && (s.validation_status === 'failed' || s.overall_status === 'failed')) || 
                                             statuses.find((s: any) => s.validation_status === 'failed' || s.overall_status === 'failed');
                        if (failedStatus && failedStatus.status_message) {
                            alert(`Validation Warning:\n\n${failedStatus.status_message}`);
                            setIsRevalidating(false);
                            return; // Stop polling, allow user to trigger again
                        }
                    }
                }
            }
            
            setRevalidationSuccessOpen(true);
            
            // Polling Logic: Try to fetch results every 5 seconds for up to 2 minutes
            const MAX_ATTEMPTS = 24; // 24 * 5s = 120s
            let attempts = 0;
            let success = false;

            const fetchValidationResult = useValidationStore.getState().fetchValidationResult;

            while (attempts < MAX_ATTEMPTS && !success) {
                attempts++;
                console.log(`[Rerun] Polling attempt ${attempts}/${MAX_ATTEMPTS}...`);
                
                // Wait 5 seconds between polls
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                await fetchValidationResult(activeProjectId, activeWorkbookId, activeRunId);
                
                // Check if data is now available in the store
                const currentData = useValidationStore.getState().validationData[activeWorkbookId];
                if (currentData && currentData.metrics && currentData.metrics.totalChecks > 0) {
                    success = true;
                    console.log("[Rerun] Successfully fetched updated results!");
                }
            }

            if (!success) {
                console.warn("[Rerun] Polling timed out without finding updated results.");
                alert("Polling timed out. The backend might still be processing; results will update automatically once ready.");
            }
            
        } catch (err: any) {
            alert("Failed to re-run validation: " + err.message);
        } finally {
            setIsRevalidating(false);
        }
    };

    const toggleGroup = (groupName: string, isCurrentlyCollapsed: boolean) => {
        setCollapsedGroups((prev: Record<string, boolean>) => ({
            ...prev,
            [groupName]: !isCurrentlyCollapsed
        }));
    };

    // Core data extraction from payload
    const migrationComparison = migrationData?.migration_comparison || {};
    const summary = migrationComparison?.summary || migrationData?.summary || migrationData?.validation_summary || {};
    const metrics = migrationComparison?.metrics || migrationData?.metrics || migrationData?.validation_metrics || {};
    const overallAiSummary = migrationComparison?.overall_ai_summary || migrationData?.overall_ai_summary || null;
    const displayName = migrationData?.workbook_name || migrationData?.workbookId || "Migration Assets";

    // Technical logs - now nested inside migration_comparison from mapper
    const technicalLogs = migrationComparison?.technical_logs || migrationData?.technical_logs || migrationData?.validation_logs || {};
    const metadataValidation = technicalLogs?.metadata_validation || migrationData?.metadata_validation || {};
    const logicValidation = technicalLogs?.logic_validation || migrationData?.logic_validation || {};
    const interactiveValidation = technicalLogs?.interactive_validation || migrationData?.interactive_validation || {};
    const runtimeValidation = technicalLogs?.runtime_validation || migrationData?.runtime_validation || {};

    // Detailed lists for specific categories
    const detailedMetrics = migrationData?.detailed_metrics || {};

    // Accuracy resolution from multiple potential paths in the payload
    let overallAccuracyRaw = migrationData?.accuracy_percentage || 
                           migrationData?.overall_accuracy || 
                           migrationComparison?.accuracy_percentage ||
                           migrationComparison?.overall_accuracy ||
                           summary?.overall_accuracy || 
                           summary?.accuracy_percentage ||
                           metrics?.overall_accuracy || 
                           "0%";

    // Fallback: If still 0% and we have a summary string, try to extract a percentage
    if ((overallAccuracyRaw === "0%" || overallAccuracyRaw === 0) && typeof overallAiSummary === 'string') {
        const match = overallAiSummary.match(/(\d+(?:\.\d+)?%)/);
        if (match) overallAccuracyRaw = match[1];
    }

    const overallAccuracy = typeof overallAccuracyRaw === 'object' ?
        (overallAccuracyRaw.accuracy_percentage || overallAccuracyRaw.overall_accuracy || "0%") :
        overallAccuracyRaw;

    // Map UI category labels to internal payload keys
    const categoryKeyMap: Record<string, string> = {
        "Datasources": "datasource_validation",
        "Datasource": "datasource_validation",
        "Datasource Validation": "datasource_validation",
        "Connections": "datasource_validation",
        "Tables & Columns": "tables",
        "Tables": "tables",
        "Table": "tables",
        "Relationships": "relationship_validation",
        "Relationship": "relationship_validation",
        "LOD Expressions": "lod_validation",
        "LOD Expression": "lod_validation",
        "Measures": "measures_validation",
        "Measure": "measures_validation",
        "Custom SQL": "custom_sql_validation",
        "Actions": "action_validation",
        "Action": "action_validation",
        "Interactive": "interactive_validation",
        "Visuals": "visual_validation",
        "Visual": "visual_validation",
        "Formatting": "formatting",
        "Parameters": "parameters",
        "Sets": "sets",
        "Security": "security",
        "RLS/Permission": "rls",
        "Row Count": "row_count",
        "Aggregate": "aggregate",
        "Calculated Fields": "calculated_fields",
        " Visual Validation": "visual_validation",
        "Visual Validation": "visual_validation",
        "Visuals Validation": "visual_validation",
    };

    const getCategoryIcon = (cat: string) => {
        const lowCat = cat.toLowerCase();
        // High priority matches
        if (lowCat.includes("visual")) return <PieChart style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("calculated field") || lowCat.includes("calculation") || lowCat.includes("measure")) return <Calculator style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("relationship")) return <LinkIcon style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("datasource")) return <Database style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("connection")) return <PlugZap style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("table")) return <TableIcon style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("data validation") || lowCat.includes("fabric")) return <ShieldCheck style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("action")) return <MousePointerClick style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("sql")) return <Code style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("filter")) return <Filter style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("parameter")) return <Settings style={{ color: "var(--primary)" }} />;
        if (lowCat.includes("set")) return <Shapes style={{ color: "var(--primary)" }} />;

        // Fallback
        return <BrainCircuit style={{ color: "var(--primary)" }} />;
    };

    /**
     * Helper to find the calculated fields object anywhere in the payload
     */
    const findCalculations = (obj: any): any => {
        if (!obj) return null;

        // Helper to parse potential JSON strings
        const tryParse = (val: any) => {
            if (typeof val !== 'string' || !val.trim().startsWith('{')) return null;
            try { return JSON.parse(val); } catch (e) { return null; }
        };

        // 1. Literal check for the user's key structure at the root
        if (obj.calculated_fields && typeof obj.calculated_fields === 'object' && (obj.calculated_fields.groups || obj.calculated_fields.details)) return obj.calculated_fields;

        if (obj.calculation_validation && typeof obj.calculation_validation === 'object') {
            const cv = obj.calculation_validation;
            if (cv.calculated_fields) return cv.calculated_fields;
            // Only return directly if it has meaningful content
            if (cv.groups || (cv.details && Array.isArray(cv.details) && cv.details.length > 0)) return cv;
        }

        // 2. Try DIRECT paths first (Targeted lookup)
        const directPaths = [
            obj.calculation_breakdown,
            obj.calculation_summary,
            obj.data?.calculation_breakdown,
            obj.data?.calculation_summary,
            obj.calculated_fields,
            obj.technical_logs?.calculation_validation?.calculated_fields,
            obj.technical_logs?.calculation_validation,
            obj.calculation_validation?.calculated_fields,
            obj.calculation_validation,
            obj.migration_comparison?.calculated_fields,
            obj.migration_comparison?.calculation_breakdown,
            obj.migration_comparison?.calculation_summary,
            obj.data?.calculated_fields,
            obj.data?.calculation_validation?.calculated_fields,
            tryParse(obj.technical_logs)?.calculation_validation?.calculated_fields,
            tryParse(obj.technical_logs)?.calculation_validation
        ];

        for (const path of directPaths) {
            if (path && typeof path === 'object') {
                // Ensure it's not just a summary object (measures as string vs array)
                const isSummaryOnly = typeof path.measures === 'string' || typeof path.dimensions === 'string';
                // Check for items nested in measures/dimensions etc
                const hasItems = (path.measures?.items && Array.isArray(path.measures.items)) || (path.dimensions?.items && Array.isArray(path.dimensions.items));
                
                if (!isSummaryOnly && (path.groups || path.summary || Array.isArray(path.details) || Array.isArray(path.measures) || hasItems)) return path;
            }
        }

        // 3. Iterative search for the rich calculations object as fallback
        let bestCandidate: any = null;
        let maxScore = -1;
        const seen = new Set();
        const stack: { item: any, depth: number }[] = [{ item: obj, depth: 0 }];

        while (stack.length > 0) {
            const entry = stack.pop();
            if (!entry) continue;
            let { item, depth } = entry;

            if (!item || depth > 25) continue;

            // Handle if item is a JSON string
            const parsed = tryParse(item);
            if (parsed) item = parsed;

            if (typeof item !== 'object' || seen.has(item)) continue;
            seen.add(item);

            // Check for structure
            const hasGroups = item.groups && typeof item.groups === 'object';
            const hasSummary = item.summary && typeof item.summary === 'object';
            const isArray = (k: string) => Array.isArray(item[k]);
            const looksLikeCalc = isArray('measures') || isArray('lods') || isArray('table_calculations') || isArray('dimensions') || isArray('details');

            if (hasGroups || hasSummary || looksLikeCalc) {
                // Scoring system
                let score = 0;
                if (hasGroups) score += 35; // Very high weight for groups
                if (hasSummary) score += 15;
                if (looksLikeCalc) score += 20;
                if (item.calculated_fields) score += 20;

                // Add item count to score
                let itemCount = 0;
                if (hasGroups) {
                    Object.values(item.groups).forEach((g: any) => {
                        if (Array.isArray(g)) itemCount += g.length;
                    });
                } else if (Array.isArray(item.details)) {
                    itemCount = item.details.length;
                } else {
                    ['measures', 'lods', 'table_calculations', 'dimensions'].forEach(k => {
                        if (Array.isArray(item[k])) itemCount += item[k].length;
                    });
                }
                score += (itemCount > 50 ? 50 : itemCount);

                if (score > maxScore) {
                    maxScore = score;
                    bestCandidate = item;
                    // Early-exit once this candidate's heuristic score clears
                    // EXCELLENT_MATCH_SCORE -- unrelated to the 0-100 percentage
                    // score bands used elsewhere (AssessmentTab, MappingTab):
                    // this is an unbounded points total from the ad-hoc
                    // weighting above, not a percentage.
                    if (score > EXCELLENT_MATCH_SCORE) return item;
                }
            }

            // Push children to stack
            if (Array.isArray(item)) {
                for (let i = item.length - 1; i >= 0; i--) {
                    if (item[i]) stack.push({ item: item[i], depth: depth + 1 });
                }
            } else {
                for (const key in item) {
                    const sub = item[key];
                    if (sub) stack.push({ item: sub, depth: depth + 1 });
                }
            }
        }

        return bestCandidate;
    };


    /**
     * Helper to find calculation-specific data from the payload
     */
    const getCalculationData = (category: string) => {
        const rawCalcFields = findCalculations(migrationData);
        if (!rawCalcFields) return null; // Return null to allow fallbacks in getCategoryData

        // Create a shallow copy and guarantee structure
        const calcFields = { ...rawCalcFields };

        // Safety: If details is empty but groups exists, flatten them now
        if ((!calcFields.details || calcFields.details.length === 0) && calcFields.groups) {
            const allItems: any[] = [];
            Object.values(calcFields.groups).forEach((group: any) => {
                if (Array.isArray(group)) allItems.push(...group);
            });
            calcFields.details = allItems;
        }

        const lowCat = category.toLowerCase();
        const isMain = lowCat.includes('calculated fields') || lowCat.includes('calculation');

        if (isMain) return calcFields;

        // Sub-categories: Ensure they return both details and a summary context
        if (calcFields.groups) {
            const summary = calcFields.summary || calcFields;
            // Ensure we check both lowercase and exact case to be safe
            const getGroup = (key: string) => {
                const val = calcFields.groups[key] || calcFields.groups[key.toLowerCase()] || calcFields.groups[key.toUpperCase()];
                if (val && typeof val === 'object' && !Array.isArray(val) && val.items) return val.items;
                return val;
            };

            if (lowCat.includes("measure") && getGroup("measures"))
                return { details: getGroup("measures"), groups: calcFields.groups, summary };
            if (lowCat.includes("lod") && (getGroup("lods") || getGroup("lod_expressions") || getGroup("lod expressions")))
                return { details: getGroup("lods") || getGroup("lod_expressions") || getGroup("lod expressions"), groups: calcFields.groups, summary };
            if (lowCat.includes("table_calc") && getGroup("table_calculations"))
                return { details: getGroup("table_calculations"), groups: calcFields.groups, summary };
            if (lowCat.includes("dimension") && getGroup("dimensions"))
                return { details: getGroup("dimensions"), groups: calcFields.groups, summary };
        }

        const nestedKey = categoryKeyMap[category] || lowCat.replace(/\s+/g, "_");
        if (calcFields[nestedKey]) {
            const nested = calcFields[nestedKey];
            if (typeof nested === 'object' && !Array.isArray(nested) && (nested.details || nested.items)) {
                return { ...nested, summary: calcFields.summary || calcFields || nested.summary };
            }
            return nested;
        }

        return null;
    };


    /**
     * Helper to find detailed data for a selected category
     */
    const getCategoryData = (category: string): any => {
        const nestedKey = categoryKeyMap[category] || category.toLowerCase().replace(/\s+/g, "_");

        // 1. Priority: Calculation-related categories
        const searchTerms = ["calculation", "measure", "lod", "dimension", "table_calc"];
        const lowerCat = category.toLowerCase();
        if (searchTerms.some(term => nestedKey.toLowerCase().includes(term) || lowerCat.includes(term))) {
            const calcResult = getCalculationData(category);
            if (calcResult) return calcResult;
        }

        let result = null;

        // 2. Specialized handling for Data Validation
        if (category === "Data Validation" || category === "Data Validation" || category === "Fabric" || nestedKey === 'fabric_validation') {
            // Find all potential candidates
            const candidates = [
                migrationData?.fabric_validation,
                migrationComparison?.fabric_validation,
                migrationData?.data?.fabric_validation,
                technicalLogs?.fabric_validation,
                summary[category],
                summary[nestedKey],
                metrics[category],
                metrics[nestedKey],
                migrationData?.fabric_validation_results,
                migrationComparison?.fabric_validation_results
            ].filter(c => c !== null && c !== undefined && typeof c !== 'string' && typeof c !== 'number' && typeof c !== 'boolean');

            // Prioritize candidates that actually have detail arrays
            let bestMatch = candidates.find(c => {
                if (Array.isArray(c) && c.length > 0) return true;
                if (c.details && Array.isArray(c.details) && c.details.length > 0) return true;
                if (c.row_count_comparison && Array.isArray(c.row_count_comparison) && c.row_count_comparison.length > 0) return true;
                if (c.live_fabric_row_counts && Array.isArray(c.live_fabric_row_counts) && c.live_fabric_row_counts.length > 0) return true;
                return false;
            }) || candidates[0];

            if (bestMatch) {
                // If it's the rich object, ensure details points to the row count comparison array
                if (!Array.isArray(bestMatch) && !bestMatch.details) {
                    bestMatch.details = bestMatch.row_count_comparison || bestMatch.live_fabric_row_counts || bestMatch.fabric_validation ||
                        (bestMatch.summary && (bestMatch.summary.row_count_comparison || bestMatch.summary.live_fabric_row_counts));

                    // Recursive array finder as final fallback
                    if (!bestMatch.details || (Array.isArray(bestMatch.details) && bestMatch.details.length === 0)) {
                        const firstArr = Object.values(bestMatch).find(v => Array.isArray(v) && v.length > 0);
                        if (firstArr) bestMatch.details = firstArr;
                    }
                }
                return bestMatch;
            }
        }
        // 3. Specialized handling for Tables, Relationships and Datasources
        if (category === "Datasources" || category === "Datasource" || nestedKey === 'datasource_validation') {
            result = migrationData?.datasource_validation || migrationComparison?.datasource_validation || technicalLogs?.metadata_validation?.datasource_validation || migrationData?.summary?.datasource_validation;
            if (result) {
                if (Array.isArray(result) && !(result as any).details) result = { details: result, summary: { total: result.length, matched: result.filter((r: any) => r?.status === "PASS").length } };
                return result;
            }
        }

        if (category === "Tables & Columns" || category === "Tables" || category === "Table" || nestedKey === 'tables') {
            result = migrationData?.tables || migrationComparison?.tables || technicalLogs?.metadata_validation?.tables || migrationData?.summary?.tables;
            if (result) {
                if (result.validated_tables && !result.details) result.details = result.validated_tables;
                return result;
            }
        } else if (category === "Relationships" || category === "Relationship" || nestedKey === 'relationship_validation') {
            result = migrationData?.relationship_validation || migrationComparison?.relationship_validation || technicalLogs?.metadata_validation?.relationships || migrationData?.summary?.relationship_validation;
            if (result) {
                if (result.items && !result.details) result.details = result.items;
                return result;
            }
        }

        // 4. Check directly on migrationData (mapper flattens sub-validations here)
        if (!result && migrationData && migrationData[nestedKey]) result = migrationData[nestedKey];

        // 5. Check on migrationComparison (mapper also places sub-validations here)
        if (!result && migrationComparison && migrationComparison[nestedKey]) result = migrationComparison[nestedKey];

        // 5b. Extra check for Visuals variations
        if (!result && (category.toLowerCase().includes("visual") || nestedKey.includes("visual"))) {
            result = migrationData?.visual_validation || migrationData?.visuals_validation || migrationData?.visuals || migrationComparison?.visual_validation || migrationComparison?.visuals_validation || migrationComparison?.visuals || migrationData?.visual_validation_results;
            // Handle if result is the rich object but we need the list
            if (result && !Array.isArray(result) && !result.details && result.visuals) result.details = result.visuals;
            if (result && !Array.isArray(result) && !result.details && result.items) result.details = result.items;
            if (result && !Array.isArray(result) && !result.details && result.results) result.details = result.results;
        }

        // 6. Fallback to technical logs sub-objects
        if (!result || (Array.isArray(result) && result.length === 0) || (result.details && result.details.length === 0)) {
            // Direct technical log keys
            const directLogResult = technicalLogs[nestedKey];
            if (directLogResult && (directLogResult.details || directLogResult.items || Array.isArray(directLogResult))) {
                result = directLogResult;
            }

            // Search inside metadata_validation for tables/relationships/datasources/connections
            if (!result || (Array.isArray(result) && result.length === 0)) {
                const metaVal = technicalLogs?.metadata_validation;
                if (metaVal && metaVal[nestedKey]) {
                    result = metaVal[nestedKey];
                }
                // Try plural/singular variations
                const shortKey = nestedKey.replace('_validation', '').replace('_', '');
                if (!result && metaVal) {
                    for (const mk of Object.keys(metaVal)) {
                        if (mk.includes(shortKey) || shortKey.includes(mk.replace(/s$/, ''))) {
                            result = metaVal[mk];
                            break;
                        }
                    }
                }
            }

            // Search other log sub-keys
            if (!result || (Array.isArray(result) && result.length === 0)) {
                const logKeys = ["action_validation", "calculation_validation", "lod_validation", "measures_validation", "interactive_validation", "custom_sql_validation"];
                for (const k of logKeys) {
                    const entry = technicalLogs[k] || migrationData[k];
                    if (entry && (k === nestedKey || k.includes(nestedKey) || nestedKey.includes(k.replace('_validation', '')))) {
                        result = entry;
                        break;
                    }
                    if (entry && entry[nestedKey]) {
                        result = entry[nestedKey];
                        break;
                    }
                }
            }
        }

        // 7. Robust fallback for specific sub-categories inside calculated_fields groups
        if (!result || (Array.isArray(result) && result.length === 0) || (result?.details && result.details.length === 0)) {
            if (nestedKey.includes('lod') || nestedKey.includes('measure') || nestedKey.includes('dimension') || nestedKey.includes('table_calc')) {
                const calcFields = migrationData?.calculated_fields || migrationData?.calculation_validation || migrationData?.calculation_summary || migrationComparison?.calculated_fields || migrationComparison?.calculation_validation;
                if (calcFields?.groups) {
                    if (nestedKey.includes('lod') && (calcFields.groups.lods || calcFields.groups.lod_expressions)) {
                        const items = calcFields.groups.lods || calcFields.groups.lod_expressions;
                        result = { details: items, groups: calcFields.groups, summary: calcFields.summary };
                    } else if (nestedKey.includes('measure') && calcFields.groups.measures) {
                        result = { details: calcFields.groups.measures, groups: calcFields.groups, summary: calcFields.summary };
                    } else if (nestedKey.includes('dimension') && calcFields.groups.dimensions) {
                        result = { details: calcFields.groups.dimensions, groups: calcFields.groups, summary: calcFields.summary };
                    } else if (nestedKey.includes('table_calc') && calcFields.groups.table_calculations) {
                        result = { details: calcFields.groups.table_calculations, groups: calcFields.groups, summary: calcFields.summary };
                    }
                }
            }
        }

        return result;
    };

    /**
     * Parse percentage string or number to a cleaner display string
     */
    const parseAccuracy = (val: any): string | null => {
        if (val === undefined || val === null) return null;
        if (typeof val === 'object') {
            if (val.overall_accuracy !== undefined) return parseAccuracy(val.overall_accuracy);
            if (val.summary?.overall_accuracy !== undefined) return parseAccuracy(val.summary.overall_accuracy);
            if (val.accuracy_percentage !== undefined) return parseAccuracy(val.accuracy_percentage);
            if (val.accuracy !== undefined) return parseAccuracy(val.accuracy);
            return null;
        }
        if (typeof val === 'string') {
            if (val.includes('%')) return val;
            if (!isNaN(parseFloat(val))) {
                const num = parseFloat(val);
                return num > 1 ? `${Math.round(num)}%` : `${Math.round(num * 100)}%`;
            }
            return val;
        }
        if (typeof val === 'number') {
            return val > 1 ? `${Math.round(val)}%` : `${Math.round(val * 100)}%`;
        }
        return String(val);
    };

    /**
     * Get percentage for a specific category from summary or technical logs
     */
    const getCategoryPercentage = (category: string): string | null => {
        // Enforce N/A for Custom SQL when there are no queries validated
        if (category.toLowerCase() === "custom sql") {
            const data = getCategoryData(category);
            const details = Array.isArray(data) ? data : (data?.details || []);
            if (details.length === 0) {
                return "N/A";
            }
        }

        // * PRIORITY 0: For Calculated Fields, use calculation_summary.accuracy_percentage directly from API
        const isCalcCategory = category === "Calculated Fields" || category === "Calculations" || category === "Measures" || category === "LOD Expressions" || category === "Table Calculations" || category === "Dimensions";
        if (isCalcCategory) {
            // Check top-level summary first
            const calcSummary = migrationData?.calculation_summary || migrationComparison?.calculation_summary || migrationData?.calculated_fields?.summary || migrationData?.data?.calculation_summary;
            if (calcSummary) {
                const val = calcSummary.accuracy_percentage ?? calcSummary.overall_accuracy ?? calcSummary.accuracy ?? calcSummary.accuracy_score;
                if (val !== undefined && val !== null) {
                    const parsed = parseAccuracy(val);
                    if (parsed && parsed !== "N/A") return parsed;
                }
            }

            // Check breakdown for specific sub-categories
            const breakdown = migrationData?.calculation_breakdown || migrationData?.data?.calculation_breakdown || migrationComparison?.calculation_breakdown;
            if (breakdown) {
                const lowCat = category.toLowerCase();
                const subKey = lowCat.includes("measure") ? "measures" : 
                             lowCat.includes("lod") ? "lods" : 
                             lowCat.includes("table") ? "table_calculations" : 
                             lowCat.includes("dimension") ? "dimensions" : null;
                
                if (subKey && breakdown[subKey]) {
                    const bVal = breakdown[subKey].accuracy ?? breakdown[subKey].accuracy_percentage ?? breakdown[subKey].accuracy_score;
                    if (bVal !== undefined && bVal !== null) {
                        const parsed = parseAccuracy(bVal);
                        if (parsed && parsed !== "N/A") return parsed;
                    }
                }
            }
        }

        // * PRIORITY 0b: Check the actual detailed validation object for this category
        const nestedKey = categoryKeyMap[category] || category.toLowerCase().replace(/\s+/g, '_');
        const detailedObj = migrationData[nestedKey] || migrationComparison[nestedKey] || technicalLogs[nestedKey];
        if (detailedObj && typeof detailedObj === 'object' && !Array.isArray(detailedObj)) {
            const detailedAcc = detailedObj.accuracy_percentage ?? detailedObj.overall_accuracy ?? detailedObj.accuracy ?? detailedObj.accuracy_score;
            if (detailedAcc !== undefined && detailedAcc !== null) {
                const parsed = parseAccuracy(detailedAcc);
                if (parsed && parsed !== "N/A") return parsed;
            }
        }

        // * PRIORITY 1: metrics object from migration_comparison.metrics
        const metricObj = (metrics && metrics[category]) || (metrics && metrics[nestedKey]);
        if (metricObj) {
            const metAcc = metricObj?.accuracy_percentage ?? metricObj?.overall_accuracy ?? metricObj?.accuracy ?? metricObj?.accuracy_score;
            if (metAcc !== undefined && metAcc !== null) {
                const parsed = parseAccuracy(metAcc);
                if (parsed && parsed !== "N/A") return parsed;
            }
            const metAccFull = parseAccuracy(metricObj);
            if (metAccFull && metAccFull !== "N/A") return metAccFull;
        }

        // * PRIORITY 2: summary from migration_comparison.summary
        if (summary) {
            const sumVal = summary[category] || summary[category.replace(/\s+/g, '_')] || summary[category.toLowerCase()] || (nestedKey ? summary[nestedKey] : undefined);
            if (sumVal !== undefined && sumVal !== null && sumVal !== "NOT_RUN") {
                if (typeof sumVal === 'object' && sumVal !== null) {
                    const innerAcc = sumVal.accuracy_percentage ?? sumVal.overall_accuracy ?? sumVal.accuracy ?? sumVal.accuracy_score;
                    if (innerAcc !== undefined) {
                        const parsed = parseAccuracy(innerAcc);
                        if (parsed && parsed !== "N/A") return parsed;
                    }
                }
                const sumAcc = parseAccuracy(sumVal);
                if (sumAcc && sumAcc !== "N/A") return sumAcc;
            }
        }

        // * PRIORITY 3: Data from getCategoryData (technical logs, sub-validation objects)
        const data = getCategoryData(category);
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            // Data Validation special path
            if (category === "Data Validation" || category === "Fabric") {
                const fbAcc = data.overall_accuracy_percentage ?? data.accuracy_percentage ?? data.accuracy ?? data.summary?.overall_accuracy_percentage ?? data.summary?.accuracy_percentage;
                if (fbAcc) {
                    const parsed = parseAccuracy(fbAcc);
                    if (parsed && parsed !== "N/A") return parsed;
                }
            }

            const subProp = data.summary?.overall_accuracy ||
                data.summary?.accuracy_percentage ||
                data.summary?.overall_accuracy_percentage ||
                data.summary?.accuracy ||
                data.overall_accuracy ||
                data.accuracy_percentage ||
                data.overall_accuracy_percentage ||
                data.accuracy ||
                data.accuracy_score;
            if (subProp) {
                const spc = parseAccuracy(subProp);
                if (spc && spc !== "N/A") return spc;
            }
        }

        const logAccuracy = parseAccuracy(data);
        if (logAccuracy && logAccuracy !== "N/A" && logAccuracy !== "0%" && logAccuracy !== "0.0%") {
            return logAccuracy;
        }

        // * PRIORITY 4: Calculate from details array
        const details = Array.isArray(data) ? data : (data?.details || []);
        if (details.length > 0) {
            const matchedCount = details.filter((d: any) => {
                const s = String(d.status || d.comparison?.status || d.parity_status || '').toUpperCase();
                const aVal = d.accuracy_percentage ?? d.accuracy ?? d.comparison?.accuracy_percentage ?? d.comparison?.accuracy_score ?? d.accuracy_score;
                const a = parseFloat(String(aVal || '0'));
                return s === 'PASS' || s === 'SUCCESS' || s === 'FULLY ACCURATE' || a >= 100 || (a > 0.99 && a <= 1);
            }).length;
            return `${Math.round((matchedCount / details.length) * 100)}%`;
        }

        return logAccuracy || null;
    };


    /**
     * Map severity to Fluent UI Badge colors
     */
    const getSeverityColor = (severity: string) => {
        const s = String(severity).toUpperCase();
        if (s === "HIGH" || s === "CRITICAL") return "danger";
        if (s === "MEDIUM") return "warning";
        if (s === "LOW") return "informative";
        return "subtle";
    };

    /**
     * Map category status to Fluent UI Badge colors
     */
    const getStatusColor = (category: string, statusText?: string) => {
        const text = statusText || getDisplayStatus(category);
        if (!text) return "secondary";

        const s = String(text).toLowerCase();
        if (s === "success" || s === "pass" || s === "passed" || s === "fully accurate") return "success";
        if (s === "failed" || s === "fail" || s === "danger") return "destructive";
        if (s === "partial" || s === "warning") return "warning";
        return "secondary";
    };

    /**
     * Get the display status text (Normalizing PASS/FAIL/Percentages)
     */
    const getDisplayStatus = (category: string) => {
        const nestedKey = categoryKeyMap[category] || category.toLowerCase().replace(/\s+/g, "_");
        const data = getCategoryData(category);
        let details = Array.isArray(data) ? data : (data?.details || []);

        // Safety: If details is empty but groups exists, flatten them on the fly
        if (details.length === 0 && data?.groups) {
            const allItems: any[] = [];
            Object.values(data.groups).forEach((g: any) => {
                if (Array.isArray(g)) allItems.push(...g);
            });
            details = allItems;
        }

        // * PRIORITY 0: Check metrics[category].accuracy_percentage first (most reliable)
        if (metrics && (metrics[category] || metrics[nestedKey])) {
            const mData = metrics[category] || metrics[nestedKey];
            const metricAcc = mData?.accuracy_percentage ?? mData?.overall_accuracy ?? mData?.overall_accuracy_percentage;
            if (metricAcc !== undefined && metricAcc !== null) {
                const num = parseFloat(String(metricAcc).replace('%', ''));
                if (!isNaN(num)) {
                    if (num >= 100) return "Success";
                    if (num <= 0) return "Failed";
                    return "Partial";
                }
            }
        }

        // 1. Technical/Log Status (Deeper validation results)
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            const s = String(data.status || data.summary?.status || '').toUpperCase();
            if (s === "PASS" || s === "SUCCESS") return "Success";
            if (s === "FAIL" || s === "FAILED" || s === "ERROR") return "Failed";
            if (s === "PARTIAL" || s === "WARNING") return "Partial";
        }

        // 2. Summary Status Fallback
        let val = summary[category] || summary[nestedKey];
        if (typeof val === 'object' && val !== null) {
            val = val.status || val.accuracy_percentage || val.overall_accuracy_percentage || val.accuracy || val.Interactive;
        }

        if (val !== undefined && val !== null && val !== "" && val !== "NOT_RUN") {
            const s = String(val).toUpperCase();
            if (s === "PASS" || s === "SUCCESS" || s === "100.0%" || s === "100%" || s === "100") return "Success";
            if (s === "FAIL" || s === "FAILED" || s === "0.0%" || s === "0%" || s === "0") return "Failed";

            // Handle percentages or numbers
            const numVal = s.replace('%', '');
            if (!isNaN(parseFloat(numVal))) {
                const num = parseFloat(numVal);
                if (num >= 100) return "Success";
                if (num <= 0) return "Failed";
                return "Partial";
            }
            if (s === "PARTIAL" || s === "WARNING") return "Partial";
        }

        // 3. Data Validation special case
        if (category === "Data Validation" || category === "Data Validation" || category === "Fabric") {
            const fab = migrationData?.fabric_validation;
            if (fab) {
                const fabStatus = String(fab.status || fab.parity_status || fab.summary?.status || fab.summary?.parity_status || '').toUpperCase();
                if (fabStatus === "SUCCESS" || fabStatus === "PASS" || fabStatus === "PASSED") return "Success";
                if (fabStatus === "FAIL" || fabStatus === "FAILED" || fabStatus === "ERROR") return "Failed";

                const fabAcc = fab.overall_accuracy_percentage ?? fab.accuracy_percentage ?? fab.parity_accuracy ?? fab.summary?.parity_accuracy ?? fab.summary?.accuracy_percentage;
                if (fabAcc) {
                    const num = parseFloat(String(fabAcc).replace('%', ''));
                    if (!isNaN(num)) {
                        if (num >= 99.9) return "Success";
                        if (num <= 0) return "Failed";
                        return "Partial";
                    }
                }
            }
        }

        // 4. Details Calculation Fallback
        if (details.length > 0) {
            const total = details.length;
            const matched = details.filter((d: any) => {
                const s = String(d.status || d.comparison?.status || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'FULLY ACCURATE';
            }).length;

            if (matched === total && total > 0) return "Success";
            if (matched > 0) return "Partial";

            // Check for any partial accuracy/status in details
            const hasAnyMatch = details.some((d: any) => {
                const s = String(d.status || d.comparison?.status || '').toUpperCase();
                const acc = d.accuracy_percentage || d.comparison?.accuracy_percentage || d.accuracy || 0;
                return s === 'PARTIAL' || s === 'WARNING' || parseFloat(String(acc)) > 0;
            });
            if (hasAnyMatch) return "Partial";

            return "Failed";
        }

        return "N/A";
    };

    // Build categories for the summary list - flattened to include nested Visuals (Actions, Interactive)
    const displayedCategories: [string, any][] = [];
    const seenCategories = new Set<string>();

    Object.entries(summary).forEach(([k, v]) => {
        if (v === undefined || v === "NOT_RUN" || v === "SKIPPED" || k === "overall_accuracy" || k === "Logs" || k === "logs" || k === "Connections" || k === "connections") return;

        // Consolidate Datasource Validation and Datasources
        let displayK = k;
        if (k.toLowerCase().includes("datasource") && k.toLowerCase().includes("validation")) {
            displayK = "Datasources";
        } else if (k === "Fabric Validation" || k === "Fabric") {
            displayK = "Data Validation";
        } else if (k === "Visual Validation" || k === "Visuals" || k === "Visuals Validation") {
            displayK = " Visual Validation";
        } else if (k === "Tables" || k === "Tables Validation" || k === "Tables & Columns Validation" || k === "Table") {
            displayK = "Tables & Columns";
        }

        // Skip if category already added (case-insensitive check)
        const normalizedKey = displayK.toLowerCase().trim();
        if (seenCategories.has(normalizedKey)) return;
        seenCategories.add(normalizedKey);

        const kToUse = displayK;

        const lowerK = k.toLowerCase();
        if (lowerK === "measures" || lowerK === "lod expressions" || lowerK === "lod expression" || lowerK === "measure" || lowerK.includes("lod_validation") || lowerK.includes("measures_validation") || lowerK === "connections") return;

        if (k === "Visuals" && typeof v === "object" && v !== null) {
            // Add top-level Visuals if it has an accuracy_percentage
            const vObj = v as any;
            if (vObj.accuracy_percentage !== undefined) {
                displayedCategories.push([kToUse, getCategoryPercentage(kToUse) || vObj.accuracy_percentage]);
            }
            // Add nested categories (Interactive, but exclude Actions)
            Object.entries(vObj).forEach(([nk, nv]) => {
                if (nk !== "accuracy_percentage" && nk !== "Interactive" && nk !== "Actions" && nk !== "Action") {
                    displayedCategories.push([nk, getCategoryPercentage(nk) || nv]);
                }
            });
        } else {
            const statusVal = getCategoryPercentage(kToUse) || v;
            // Defensive: ensure status is never a raw object when added to displayedCategories
            const safeStatus = (typeof statusVal === 'object' && statusVal !== null)
                ? ((statusVal as any).accuracy_percentage || (statusVal as any).overall_accuracy || (statusVal as any).status || JSON.stringify(statusVal))
                : statusVal;
            displayedCategories.push([kToUse, safeStatus]);
        }
    });

    // Proactively add "Calculated Fields" if it exists but is missing from summary
    if (!displayedCategories.find(c => c[0] === "Calculated Fields" || c[0] === "Calculations")) {
        const hasCalcs = findCalculations(migrationData);
        if (hasCalcs || metrics["Calculated Fields"]) {
            displayedCategories.push(["Calculated Fields", getCategoryPercentage("Calculated Fields") || "-"]);
        }
    }

    // Add Data Validation if present in payload but not in summary
    if (migrationData.fabric_validation && !displayedCategories.find(c => c[0] === "Data Validation" || c[0] === "Fabric Validation" || c[0] === "Fabric")) {
        displayedCategories.push(["Data Validation", getCategoryPercentage("Data Validation") || migrationData.fabric_validation?.status || "-"]);
    }

    // Proactively add "Datasources" if it exists but is missing from summary
    if (!displayedCategories.find(c => c[0] === "Datasources" || c[0] === "Datasource")) {
        const hasDatasources = migrationData?.datasource_validation || migrationComparison?.datasource_validation || migrationData?.summary?.datasource_validation;
        if (hasDatasources) {
            displayedCategories.push(["Datasources", getCategoryPercentage("Datasources") || "-"]);
        }
    }

    // * Add categories from metrics that are missing from summary
    // The API puts LOD Expressions, Measures, Actions etc. in metrics but not always in summary
    const metricsOnlyCategories = ["Actions", "Custom SQL", "Visuals", "Datasources", "Tables", "Relationships"];
    metricsOnlyCategories.forEach(cat => {
        let displayCat = cat;
        if (cat === "Visuals") displayCat = " Visual Validation";
        if (cat === "Tables") displayCat = "Tables & Columns";

        if (metrics[cat] && !displayedCategories.find(c => (c[0] === displayCat || c[0] === cat))) {
            const normalizedKey = displayCat.toLowerCase().trim();
            if (!seenCategories.has(normalizedKey)) {
                seenCategories.add(normalizedKey);
                displayedCategories.push([displayCat, getCategoryPercentage(displayCat) || getCategoryPercentage(cat) || "-"]);
            }
        }
    });

    // * Add categories from migrationData/migrationComparison sub-validations
    const subValidationCategories: [string, string][] = [
        ["Actions", "action_validation"],
    ];
    subValidationCategories.forEach(([cat, key]) => {
        if (!displayedCategories.find(c => c[0] === cat)) {
            const hasData = migrationData?.[key] || migrationComparison?.[key];
            if (hasData && ((Array.isArray(hasData) && hasData.length > 0) || (hasData.details && hasData.details.length > 0) || (hasData.status))) {
                const normalizedKey = cat.toLowerCase().trim();
                if (!seenCategories.has(normalizedKey)) {
                    seenCategories.add(normalizedKey);
                    displayedCategories.push([cat, getCategoryPercentage(cat) || "-"]);
                }
            }
        }
    });

    const totalRules = displayedCategories.length;
    const passedRules = displayedCategories.filter(([cat, status]) => getStatusColor(cat, String(status)) === "success").length;


    /** Technical content formatter for SQL/M/formula text. See ./migration-validation. */
    const renderTechnicalContent = (content: string, label: string) => (
        <TechnicalContent content={content} label={label} />
    );

    /**
     * Recursive renderer for object properties in detail view
     */
    const renderComplexValue = (v: any, type?: "source" | "target") => {
        if (v === null || v === undefined) return <Text size={200} style={{ color: "var(--text-muted)", fontFamily: T.font }}>-</Text>;

        if (typeof v === 'object') {
            // Handle specialized schema_validation or visual_type structures
            const data = v.visual_type || v;
            if (data.parsing !== undefined || data.generation !== undefined) {
                // If type is provided, only show the relevant field (Tableau for source, Power BI for target)
                if (type === "source") {
                    return (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0" }}>
                            <Text size={200} weight="semibold" style={{ color: "var(--text)", fontFamily: T.font }}>{String(data.parsing || "N/A")}</Text>
                        </div>
                    );
                }
                if (type === "target") {
                    return (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0" }}>
                            <Text size={200} weight="semibold" style={{ color: "#0369a1", fontFamily: T.font }}>{String(data.generation || "N/A")}</Text>
                        </div>
                    );
                }

                // Default (show both if type not provided)
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Text size={200} weight="semibold" style={{ color: "var(--text)", fontFamily: T.font }}>{String(data.parsing || "N/A")}</Text>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Text size={200} weight="semibold" style={{ color: "#0369a1", fontFamily: T.font }}>{String(data.generation || "N/A")}</Text>
                        </div>
                    </div>
                );
            }

            // Handle logical expressions (left operator right)
            if (v.left !== undefined && v.operator !== undefined && v.right !== undefined) {
                return (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Text size={200} weight="medium" style={{ color: "var(--text-secondary)", fontFamily: T.font }}>{v.left}</Text>
                        <Badge variant="secondary" style={{ fontFamily: T.font }}>{v.operator}</Badge>
                        <Text size={200} weight="medium" style={{ color: "var(--text-secondary)", fontFamily: T.font }}>{v.right}</Text>
                    </div>
                );
            }

            // Fallback for other objects: Show keys as a mini table or list
            const hiddenKeys = ['original_generation_column_count'];
            const entries = Object.entries(v).filter(([key, val]) => val !== null && val !== undefined && val !== "" && !Array.isArray(val) && typeof val !== 'object' && !hiddenKeys.includes(key));

            // SPECIAL HANDLING: Parity Detection for Structured Grid
            const isParityObject = entries.some(([ek]) => ek.includes('column_count') || ek.includes('datatype_match') || ek.includes('parity'));

            if (isParityObject) {
                return (
                    <div className="vl-grid-2" style={{ gap: "12px", width: "100%" }}>
                        {entries.map(([ek, ev]) => {
                            const isMatch = ek.includes('match') || ek.includes('same') || ek.includes('parity');
                            const isBoolean = typeof ev === 'boolean' || String(ev).toLowerCase() === 'true' || String(ev).toLowerCase() === 'false';
                            const boolVal = String(ev).toLowerCase() === 'true';

                            return (
                                <div key={ek} className="vl-info-item" style={{ padding: "10px 14px" }}>
                                    <div className="vl-info-label" style={{ fontSize: "9px", marginBottom: "4px" }}>{ek.replace(/_/g, ' ')}</div>
                                    <div className="vl-info-value" style={{ fontSize: "14px" }}>
                                        {isBoolean ? (
                                            <Badge variant={boolVal ? "success" : "destructive"}>
                                                {boolVal ? "PASS" : "FAIL"}
                                            </Badge>
                                        ) : (
                                            <Text weight="semibold" size={300} style={{ fontFamily: T.font }}>{String(ev)}</Text>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            }

            if (entries.length > 0) {
                return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {entries.map(([ek, ev]) => (
                            <div key={ek} style={{ display: "flex", gap: "10px", alignItems: "baseline" }}>
                                <Text size={100} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", width: "100px", flexShrink: 0 }}>{ek.replace(/_/g, ' ')}:</Text>
                                <Text size={200} weight="medium" style={{ color: "var(--text)" }}>{String(ev)}</Text>
                            </div>
                        ))}
                    </div>
                );
            }

            // Nested object fallback (Recursive call or simplified label)
            return <div style={{ padding: "8px", border: "1px solid #f1f5f9", borderRadius: "4px", backgroundColor: "#f8fafc" }}>
                <Text size={200} italic style={{ color: "var(--text-muted)" }}>Complex Component Data</Text>
            </div>;
        }

        return <Text size={200} weight="medium" style={{ color: "var(--text)", fontFamily: T.font }}>{String(v)}</Text>;
    };

    const renderObjectProperties = (title: string, objRaw: any, type: "source" | "target", mode: "all" | "properties" | "lists" = "all") => {
        if (!objRaw || typeof objRaw !== 'object') return null;
        const isSource = type === "source";

        // Detect if this is a relationship object based on specific keys
        const isRelationship = !!(objRaw.from_column || objRaw.fromColumn || objRaw.to_column || objRaw.toColumn);

        // Inject placeholders for Target if it's a relationship item
        let obj = { ...objRaw };
        if (!isSource && isRelationship) {
            // Ensure cardinality is present for target if missing
            if (obj.cardinality === undefined) obj.cardinality = "N/A";
        }

        // 1. Initial filter of raw keys
        const rawEntries = Object.entries(obj).filter(([k, v]) => {
            if (isRelationship) {
                // For relationships, we only want to show columns, cardinality and join keys
                const lowerK = k.toLowerCase();
                // Check if it's a column field, cardinality, or a join key
                if (lowerK.includes('column') || lowerK === 'cardinality' || lowerK.includes('join_keys')) return true;
                return false;
            }

            if (v === null || v === undefined || v === "") return false;
            // Allow arrays ONLY if they are join-related (to show inside cards)
            if (Array.isArray(v) && !k.includes('join')) return false;
            if (typeof v === 'string' && (v.includes("Missing in Parsing") || v.includes("Missing in Generation"))) return false;

            // Explicitly hidden fields
            if (k === 'original_generation_column_count' || k === 'cardinality_source') return false;
            // Globally hide DAX query as per client requirements
            if (k.toLowerCase().includes('dax_query') || k.toLowerCase().includes('dax query')) return false;
            // Hide actual_values unless they are meaningful
            if (k === 'actual_values' && (v === "SKIPPED - Missing Fabric connection info" || !v)) return false;

            if (k.includes('details') && k !== 'validation_details') return false;
            if (k.includes('reason') && !k.includes('datatype_reason') && k !== 'parity_reason') return false;
            const isConnectionItem = obj.parsing_datasource !== undefined || obj.generation_datasource !== undefined || obj.server !== undefined || obj.database !== undefined;
            if (!isConnectionItem && (k.includes('status') || k.includes('accuracy'))) return false;

            // For Actions, we want to see target_dashboard/target_sheet on the source side 
            // and source_dashboard/source_worksheet on the target side, so we relax these filters
            const isAction = obj.action_type !== undefined || obj.action_id !== undefined;

            if (!isAction) {
                if (isSource && (k.includes('generation') || k.includes('target') || k.includes('extra') || k.toLowerCase().includes('column'))) return false;
                if (!isSource && (k.includes('parsing') || k.includes('source') || k.includes('missing'))) return false;
            } else {
                // For actions, still hide internal parsing/generation prefixes but keep "target_dashboard" etc
                if (isSource && k.includes('generation')) return false;
                if (!isSource && k.includes('parsing')) return false;
            }

            // Redundant internal objects in Actions validation
            if (k === 'tableau_action' || k === 'powerbi_equivalent' || k === 'parameter_logic' || k === 'filters' || k === 'columns' || k === 'visual_mapping' || k.includes('join_conditions')) return false;

            return true;
        });

        // 2. De-duplicate and filter based on final display labels
        const processedEntries: [string, any][] = [];
        const seenLabels = new Set<string>();

        rawEntries.forEach(([k, v]) => {
            // Improve label formatting: handle camelCase and underscores
            const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, " ").replace(/parsing |generation /g, "").trim();
            const upperLabel = label.toUpperCase();

            // User requested to remove "NAME" and only keep "TABLE NAME"
            if (upperLabel === 'NAME') return;

            // User requested to remove "ACTUAL VALUES" - wait, user actually provided these in the new JSON, so we might want to show them if they aren't skipped
            // if (upperLabel === 'ACTUAL VALUES' || upperLabel === 'ACTUAL DATA') return;

                let finalVal = v;
                // Transform join arrays into readable strings for card display
                if (Array.isArray(v) && k.includes('join')) {
                    finalVal = v.map(item => {
                        if (typeof item === 'object' && item !== null && item.left && item.operator && item.right) {
                            return `${item.left} ${item.operator} ${item.right}`;
                        }
                        return typeof item === 'object' ? JSON.stringify(item) : String(item);
                    }).join('\n');
                }

                if (upperLabel === "SERVER" && (obj.connection_type === "textscan" || obj.mode === "live")) {
                    let sv = String(finalVal);
                    if (sv.toLowerCase().includes("missing")) sv = "Local File / N/A";
                    processedEntries.push([label, sv]);
                    seenLabels.add(upperLabel);
                    return;
                }

                processedEntries.push([label, finalVal]);
                seenLabels.add(upperLabel);
        });

        // 3. Split into Table vs Code layout
        const tableEntries = processedEntries.filter(([label]) => {
            const l = label.toLowerCase();
            return !l.includes('formula') && !l.includes('expression') && !l.includes('join keys') && !l.includes('sql query') && !l.includes('m query') && !l.includes('datatype reason');
        });

        const codeEntries = processedEntries.filter(([label]) => {
            const l = label.toLowerCase();
            return l.includes('formula') || l.includes('expression') || l.includes('join keys') || l.includes('sql query') || l.includes('m query') || l.includes('dax query') || l.includes('actual values') || l.includes('datatype reason') || l.includes('discrepancy') || l.includes('parity result');
        });

        const listEntries = Object.entries(obj).filter(([k, v]) => {
            if (!Array.isArray(v)) return false;
            // Hide specific large data arrays and join-related lists (moved to properties)
            if (k === 'source_data' || k === 'actual_values' || k === 'actual_data' || k.includes('join_conditions')) return false;

            // Hide most empty lists except for core visual validation data
            if (v.length === 0) return false;
            // Apply source/target filtering to list entries too
            // User request: Remove 'columns' from source side as they are already compared on target side
            if (isSource && (k.includes('generation') || k.includes('target') || k.toLowerCase().includes('column'))) return false;
            if (!isSource && (k.includes('parsing') || k.includes('source'))) return false;
            return true;
        });

        if (processedEntries.length === 0 && listEntries.length === 0 && !obj.formula && !obj.parsing_formula && !obj.generation_formula && !title) return null;

        return (
            <div className={fluentStyles.flexColumn}>
                {(mode === "all" || mode === "properties") && title && (
                    <Text weight="bold" size={200} className={fluentStyles.remediationIssueLabel}>
                        {title}
                    </Text>
                )}

                <div className={fluentStyles.flexColumn} style={{ gap: "16px" }}>
                    {/* Key-Value Table */}
                    {(mode === "all" || mode === "properties") && tableEntries.length > 0 && (
                        <table className={styles.tableContainer} style={{ margin: 0, width: "100%", fontSize: "12px" }}>
                            <tbody>
                                {tableEntries.map(([label, v], idx) => {
                                    return (
                                        <tr key={idx}>
                                            <td className={fluentStyles.labelCell}>
                                                <span style={{ fontWeight: 700, fontSize: "12px" }} className={fluentStyles.remediationIssueLabel}>{label}</span>
                                            </td>
                                            <td>
                                                {renderComplexValue(v, type)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Formula/Code blocks (Horizontal layout for Joins, Vertical for others) */}
                    {(() => {
                        if (mode !== "all" && mode !== "properties") return null;
                        
                        const joinEntries = codeEntries.filter(([l]) => l.toLowerCase().includes('join'));
                        const otherEntries = codeEntries.filter(([l]) => !l.toLowerCase().includes('join'));

                        return (
                            <div className={fluentStyles.flexColumn} style={{ gap: "16px" }}>
                                {joinEntries.length > 0 && (
                                    <div className={fluentStyles.flexColumn} style={{ gap: "16px" }}>
                                        {joinEntries.map(([label, v], idx) => (
                                            <div key={idx} className={fluentStyles.flexColumn} style={{ gap: "6px" }}>
                                                <Text weight="bold" size={100} className={fluentStyles.remediationIssueLabel} style={{ marginBottom: 0 }}>{label}</Text>
                                                {renderTechnicalContent(typeof v === 'object' ? JSON.stringify(v) : String(v), label)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {otherEntries.map(([label, v], idx) => (
                                    <div key={idx} className={fluentStyles.flexColumn} style={{ gap: "6px" }}>
                                        <Text weight="bold" size={100} className={fluentStyles.remediationIssueLabel} style={{ marginBottom: 0 }}>{label}</Text>
                                        {renderTechnicalContent(typeof v === 'object' ? JSON.stringify(v) : String(v), label)}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}

                    {/* List fields (columns, matched_names etc) */}
                    {(mode === "all" || mode === "lists") && listEntries.map(([k, v]) => {
                        // Improve label formatting: handle camelCase and add source/target context
                        let label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, " ").replace(/parsing |generation /g, "").trim();
                        if (label.toLowerCase() === "tables") {
                            label = type === "source" ? "Tables in Tableau" : "Tables in Power BI";
                        }



                        const list = v as any[];

                        // SPECIAL HANDLING: Column Detection for Structured Comparison Cards
                        const isColumnList = k.toLowerCase().includes('column') && list.length > 0 && typeof list[0] === 'object';

                        // Check if the list items are "complex" (e.g. objects or long data strings)
                        const isComplex = list.some(item =>
                            (item && typeof item === 'object') ||
                            (typeof item === 'string' && item.length > 30)
                        );

                        const isMatched = k.includes('matched');
                        const isMissing = k.includes('missing');

                        return (
                            <div key={k} style={{ marginTop: "12px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                                    <div style={{ backgroundColor: "var(--primary)", padding: "6px", borderRadius: "6px", display: "flex" }}>
                                        {(() => {
                                            const lowK = k.toLowerCase();
                                            if (lowK.includes('column')) return <TableIcon style={{ color: "var(--primary)", fontSize: "16px" }} />;
                                            if (lowK.includes('calc') || lowK.includes('formula')) return <Calculator style={{ color: "var(--primary)", fontSize: "16px" }} />;
                                            if (lowK.includes('matched')) return <CheckCircle2 style={{ color: "var(--primary)", fontSize: "16px" }} />;
                                            if (lowK.includes('missing')) return <Info style={{ color: "var(--primary)", fontSize: "16px" }} />;
                                            return <ClipboardList style={{ color: "var(--primary)", fontSize: "16px" }} />;
                                        })()}
                                    </div>
                                    <Text weight="bold" size={200} className={fluentStyles.remediationIssueLabel} style={{ marginBottom: 0 }}>
                                        {label} ({list.length})
                                    </Text>
                                </div>
                                <div style={{
                                    display: "flex",
                                    flexDirection: (isComplex || isColumnList) ? "column" : "row",
                                    flexWrap: "wrap",
                                    gap: (isComplex || isColumnList) ? "12px" : "8px",
                                    maxHeight: (isComplex || isColumnList) ? "400px" : "auto",
                                    overflowY: (isComplex || isColumnList) ? "auto" : "visible",
                                    paddingRight: (isComplex || isColumnList) ? "8px" : "0",
                                    paddingBottom: "4px"
                                }}>
                                    {list.length === 0 ? (
                                        <div style={{
                                            padding: "12px",
                                            backgroundColor: "#f1f5f9",
                                            borderRadius: "8px",
                                            border: "1px dashed #cbd5e1",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            color: "var(--text-muted)",
                                            fontStyle: "italic",
                                            fontSize: "12px",
                                            width: "100%"
                                        }}>
                                            <Info /> No data points available for this visual
                                        </div>
                                    ) : list.map((item, nIdx) => {
                                        if (isColumnList) {
                                            // Render a high-fidelity comparison card for the column
                                            const sName = item.parsing_column_name || item.source_name || item.name || "N/A";
                                            const tName = item.generation_column_name || item.target_name || item.name || "N/A";
                                            const sType = item.parsing_datatype || item.source_type || item.datatype || "N/A";
                                            const tType = item.generation_datatype || item.target_type || item.datatype || "N/A";
                                            const isMatch = sName === tName && (sType === tType || item.datatype_match === true || item.datatype_matches === true);

                                            return (
                                                <div
                                                    key={nIdx}
                                                    className={fluentStyles.hoverCard}
                                                    style={{
                                                        padding: "16px 20px",
                                                        backgroundColor: "var(--surface)",
                                                        border: `1px solid var(--border)`,
                                                        borderRadius: "12px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: "24px"
                                                    }}
                                                >
                                                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "12px" }}>
                                                        <Badge variant="secondary">{nIdx + 1}</Badge>
                                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                                            <Text weight="bold" size={200} style={{ color: "var(--text-muted)", fontSize: "10px" }}>SOURCE</Text>
                                                            <Text weight="semibold" size={200}>{sName}</Text>
                                                            <Text size={100} style={{ color: "var(--text-muted)" }}>{sType}</Text>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "var(--text-muted)" }}>
                                                        <div style={{ width: "1px", height: "15px", backgroundColor: "var(--border)" }}></div>
                                                        <Text size={100} weight="bold" style={{ margin: "4px 0", fontSize: "9px" }}>VS</Text>
                                                        <div style={{ width: "1px", height: "15px", backgroundColor: "var(--border)" }}></div>
                                                    </div>

                                                    <div style={{ flex: 1, display: "flex", flexDirection: "column", textAlign: "right" }}>
                                                        <Text weight="bold" size={200} style={{ color: "var(--warning)", fontSize: "10px" }}>TARGET</Text>
                                                        <Text weight="semibold" size={200}>{tName}</Text>
                                                        <Text size={100} style={{ color: "var(--text-muted)" }}>{tType}</Text>
                                                    </div>

                                                    <div style={{ paddingLeft: "12px" }}>
                                                        <Badge variant={isMatch ? "success" : "warning"}>
                                                            {isMatch ? "MATCH" : "DIFF"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        let displayText = "";
                                        if (item && typeof item === 'object') {
                                            if (item.left && item.operator && item.right) {
                                                displayText = `${item.left} ${item.operator} ${item.right}`;
                                            } else {
                                                // Handle nested data objects by rendering their first few important keys
                                                const dKeys = Object.keys(item).filter(k => k !== 'status' && k !== 'accuracy' && typeof item[k] !== 'object');
                                                if (dKeys.length > 0) {
                                                    displayText = dKeys.slice(0, 4).map(k => `${k.replace(/_/g, ' ')}: ${item[k]}`).join(' | ');
                                                } else {
                                                    displayText = "[Complex Data Object]";
                                                }
                                            }
                                        } else {
                                            displayText = String(item);
                                        }

                                        if (isComplex) {
                                            return (
                                                <div
                                                    key={nIdx}
                                                    style={{
                                                        padding: "10px",
                                                        backgroundColor: "#f8fafc",
                                                        border: "1px solid #e2e8f0",
                                                        borderRadius: "6px",
                                                        fontFamily: T.mono,
                                                        fontSize: "11px",
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-all",
                                                        color: "var(--text-secondary)",
                                                        lineHeight: "1.5"
                                                    }}
                                                >
                                                    {displayText}
                                                </div>
                                            );
                                        }

                                        return (
                                            <Badge
                                                key={nIdx}
                                                variant={isMatched ? "success" : isMissing ? "destructive" : "secondary"}
                                                className={fluentStyles.badgeSmall}
                                                style={{ height: "auto", minHeight: "22px", padding: "4px 10px" }}
                                            >
                                                {displayText}
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}


                    {/* Logic/Formula Fallback - Only if not already rendered as a list or table entry */}
                    {(() => {
                        const formulaVal = isSource ? (obj.parsing_formula || obj.formula) : (obj.generation_formula || obj.formula);
                        if (!formulaVal) return null;

                        // Avoid double rendering if already in processedEntries/listEntries
                        const alreadyRendered = processedEntries.some(([l]) => l.toLowerCase().includes('formula')) || listEntries.some(([k]) => k.toLowerCase().includes('formula'));
                        if (alreadyRendered) return null;

                        return (
                            <div className={fluentStyles.flexColumn} style={{ gap: "6px", marginTop: "12px" }}>
                                <Text weight="bold" size={200} className={fluentStyles.remediationIssueLabel}>
                                    Mapped Logic
                                </Text>
                                {renderTechnicalContent(typeof formulaVal === 'object' ? JSON.stringify(formulaVal) : String(formulaVal), "formula")}
                            </div>
                        );
                    })()}
                </div>
            </div>
        );
    };


    /** Name reconciliation table for metrics summary. See ./migration-validation. */
    const renderNameReconciliation = (catMetrics: any) => (
        <NameReconciliationTable categoryMetrics={catMetrics} />
    );

    /**
     * Renders the Technical Logs tab content
     */



    /**
     * Detail panel renderer for Dialog
     */
    const renderCategoryDetail = (category: string) => {
        const data = getCategoryData(category);
        const nestedKey = categoryKeyMap[category] || category.toLowerCase().replace(/\s+/g, "_");

        // Find metrics for this category from migration_comparison.metrics
        const categoryMetrics = metrics[category] || metrics[category.replace(/\s+/g, " ")] || null;

        // Find if there's a technical log entry for this category
        const logEntry = migrationData[nestedKey] || metadataValidation[nestedKey] || logicValidation[nestedKey] || interactiveValidation[nestedKey] || runtimeValidation[nestedKey];

        const isCalculatedFields = category === "Calculated Fields" || category === "Calculations" || nestedKey === "calculated_fields" || category === "Measures" || category === "LOD Expressions" || category === "Table Calculations";
        const isTables = category === "Tables & Columns" || category === "Tables" || category === "Table" || nestedKey === "tables";
        const isRelationships = category === "Relationships" || category === "Relationship" || nestedKey === "relationship_validation";
        const isDatasources = category === "Datasources" || category === "Datasource" || nestedKey === "datasource_validation";
        const isConnections = category === "Connections" || category === "Connection" || category.toLowerCase().includes("connection") || nestedKey === "connection_validation";
        const isFabric = category === "Data Validation" || category === "Fabric" || nestedKey === "fabric_validation";
        const isCustomSql = category.toLowerCase().includes("custom sql") || nestedKey.includes("custom_sql") || category === "Connection Strategy";

        // Safety: Ensure details is always an array
        let details = Array.isArray(data) ? data :
            (Array.isArray(data?.details) ? data.details :
                (Array.isArray(data?.datasource_validation) ? data.datasource_validation :
                    (Array.isArray(data?.fabric_validation) ? data.fabric_validation : [])));

        // Safety: If details is empty but groups exists, flatten them on the fly
        if ((!details || details.length === 0) && data?.groups) {
            const allItems: any[] = [];
            Object.values(data.groups).forEach((g: any) => {
                if (Array.isArray(g)) allItems.push(...g);
            });
            details = allItems;
        }

        // For Fabric, if details is still empty, look for any array inside the object
        if (isFabric && (!details || details.length === 0) && data && typeof data === 'object') {
            const firstArray = Object.values(data).find(v => Array.isArray(v));
            if (firstArray) details = firstArray as any[];
        }

        // --- SPECIAL HANDLING FOR VISUALS ---
        const isVisuals = category.toLowerCase().includes("visual") || nestedKey.includes("visual");
        if (isVisuals && (!details || details.length === 0) && data) {
            // Check for visuals array directly
            if (Array.isArray(data.visuals)) details = data.visuals;
            else if (Array.isArray(data.results)) details = data.results;
            else if (Array.isArray(data.validation_details)) details = data.validation_details;
        }


        const nameReconciliation = renderNameReconciliation(categoryMetrics);


        // Special grouping logic for calculated fields if they are not pre-grouped (or if groups is arrived as a flat array)
        let finalGroups = data?.groups;
        const isFlatArray = Array.isArray(finalGroups) || (!finalGroups && details.length > 0);

        if (isCalculatedFields && isFlatArray) {
            const groups: any = {
                measures: [],
                dimensions: [],
                lods: [],
                table_calculations: []
            };

            details.forEach((item: any) => {
                const formula = String(item.parsing_formula || item.tableau_formula || item.source_formula || item.formula || "").toUpperCase();
                const name = String(item.parsing_name || item.name || "").toLowerCase();
                const type = String(item.type || item.calculation_type || item.category || "").toLowerCase();

                if (type.includes("lod") || formula.includes("FIXED") || formula.includes("INCLUDE") || formula.includes("EXCLUDE")) {
                    groups.lods.push(item);
                } else if (type.includes("table_calc") || formula.includes("TOTAL(") || formula.includes("RANK_DENSE") || formula.includes("WINDOW_") || formula.includes("RUNNING_")) {
                    groups.table_calculations.push(item);
                } else if (type.includes("dimension") || item.parsing_datatype === "string" || item.parsing_datatype === "boolean" || name.includes("name") || name.includes("date")) {
                    groups.dimensions.push(item);
                } else {
                    groups.measures.push(item);
                }
            });

            // Keep all groups even if empty for consistent UI logic
            finalGroups = groups;
        }

        // Normalize summary (renamed to catSummary to avoid shadowing outer `summary`)
        let catSummary = isCalculatedFields ? (data?.summary || {
            total: details.length,
            matched: details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'FULLY ACCURATE' || s === 'PASSED';
            }).length,
            overall_accuracy: details.length === 0 ? "N/A" : (data?.overall_accuracy || data?.accuracy_percentage || getCategoryPercentage(category) || "0%"),
            failed: details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length,
            partial: details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length,
            total_measures: data?.groups?.measures?.length || data?.total_measures || 0,
            total_lods: data?.groups?.lods?.length || data?.total_lods || 0,
            total_table_calculations: data?.groups?.table_calculations?.length || data?.total_table_calculations || 0,
            total_dimensions: data?.groups?.dimensions?.length || data?.total_dimensions || 0
        }) : isFabric ? {
            total: (data?.summary?.total_fabric_tables !== undefined) ? data.summary.total_fabric_tables :
                (data?.summary?.total !== undefined) ? data.summary.total : details.length,
            matched: details.filter((i: any) => {
                const s = String(i.status || i.parity_status || i.parity_result || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED' || s.includes('MATCH EXACTLY');
            }).length,
            overall_accuracy: data?.overall_accuracy_percentage || data?.summary?.overall_accuracy_percentage || data?.summary?.parity_accuracy || data?.summary?.accuracy_percentage || data?.accuracy_percentage || (details.length > 0 ? (() => {
                const passed = details.filter((i: any) => {
                    const s = String(i.status || i.parity_status || i.parity_result || '').toUpperCase();
                    return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED' || s.includes('MATCH EXACTLY');
                }).length;
                return `${Math.round((passed / details.length) * 100)}%`;
            })() : "N/A"),
            failed: details.filter((i: any) => {
                const s = String(i.status || i.parity_status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length,
            partial: details.filter((i: any) => {
                const s = String(i.status || i.parity_status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length
        } : isDatasources ? {
            total: details.length,
            matched: details.filter((i: any) => {
                const s = String(i.status || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED';
            }).length,
            overall_accuracy: data?.summary?.accuracy_percentage || data?.accuracy_percentage || (details.length > 0 ? (() => {
                const totalAcc = details.reduce((acc: number, curr: any) => acc + (parseFloat(String(curr.accuracy_percentage || curr.accuracy || 0))), 0);
                return `${Math.round(totalAcc / details.length)}%`;
            })() : "N/A"),
            failed: details.filter((i: any) => {
                const s = String(i.status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length,
            partial: details.filter((i: any) => {
                const s = String(i.status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length
        } : isVisuals ? {
            total: details.length,
            matched: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || i.result || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED' || s === 'FULLY ACCURATE';
            }).length,
            overall_accuracy: data?.overall_accuracy_percentage || data?.accuracy_percentage || data?.summary?.accuracy_percentage || (details.length > 0 ? getCategoryPercentage(category) : "N/A"),
            failed: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length,
            partial: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length
        } : isTables ? {
            total: (Array.isArray(data?.validated_tables) ? data.validated_tables.length : 0),
            matched: (Array.isArray(data?.validated_tables) ? data.validated_tables.filter((t: any) => t.status === "PASS" || t.status === "SUCCESS").length : 0),
            overall_accuracy: (Array.isArray(data?.validated_tables) && data.validated_tables.length > 0) ? (data?.accuracy_percentage ? `${data.accuracy_percentage}%` : "0%") : "N/A",
            failed: (Array.isArray(data?.validated_tables) ? data.validated_tables.filter((t: any) => t.status === "FAIL" || t.status === "FAILED").length : 0),
            partial: (Array.isArray(data?.validated_tables) ? data.validated_tables.filter((t: any) => t.status === "PARTIAL").length : 0)
        } : isRelationships ? (() => {
            const total = data?.summary?.total ?? data?.summary?.count ?? data?.total ?? data?.items?.length ?? details.length ?? 0;
            const matched = (data?.summary?.matched !== undefined && data.summary.matched > 0) ? data.summary.matched :
                (data?.summary?.passed !== undefined && data.summary.passed > 0) ? data.summary.passed :
                    (Array.isArray(details) ? details.filter((i: any) => {
                        const s = String(i.status || i.comparison?.status || i.result || '').toUpperCase();
                        const aVal = i.accuracy_percentage ?? i.accuracy ?? i.comparison?.accuracy_percentage ?? i.comparison?.accuracy_score ?? i.accuracy_score;
                        const a = parseFloat(String(aVal || '0'));
                        return s === "PASS" || s === "SUCCESS" || a >= 100 || (a > 0.99 && a <= 1);
                    }).length : 0);

            return {
                total,
                matched,
                overall_accuracy: (matched === total && total > 0) ? "100.0%" : (data?.summary?.overall_accuracy || data?.summary?.accuracy_percentage || data?.accuracy_percentage || getCategoryPercentage(category) || "0%"),
                failed: (data?.summary?.failed !== undefined) ? data.summary.failed :
                    (Array.isArray(details) ? details.filter((i: any) => {
                        const s = String(i.status || i.comparison?.status || '').toUpperCase();
                        return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
                    }).length : 0),
                partial: (data?.summary?.partial !== undefined) ? data.summary.partial :
                    (Array.isArray(details) ? details.filter((i: any) => {
                        const s = String(i.status || i.comparison?.status || '').toUpperCase();
                        return s === 'PARTIAL' || s === 'WARNING';
                    }).length : 0)
            };
        })() : isCustomSql ? {
            total: details.length,
            matched: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED';
            }).length,
            overall_accuracy: data?.overall_accuracy_percentage || data?.accuracy_percentage || (details.length > 0 ? getCategoryPercentage(category) : "N/A"),
            failed: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length,
            partial: details.filter((i: any) => {
                const s = String(i.status || i.comparison?.status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length
        } : {
            // Fallback branch - prioritize category-specific metrics over workbook-level summary
            total: (Array.isArray(details) ? details.length : 0),
            matched: (Array.isArray(details) ? details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'PASS' || s === 'SUCCESS' || s === 'FULLY ACCURATE' || s === 'PASSED';
            }).length : 0),
            overall_accuracy: getCategoryPercentage(category) || "N/A",
            failed: (Array.isArray(details) ? details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'FAIL' || s === 'FAILED' || s === 'ERROR';
            }).length : 0),
            partial: (Array.isArray(details) ? details.filter((item: any) => {
                const s = String(item.status || item.comparison?.status || item.status || '').toUpperCase();
                return s === 'PARTIAL' || s === 'WARNING';
            }).length : 0)
        };

        // FINAL SANITY CHECK: Ensure overall_accuracy is never null/undefined if we have items
        if (catSummary && (catSummary.overall_accuracy === undefined || catSummary.overall_accuracy === null || catSummary.overall_accuracy === "0%")) {
            const resolvedAcc = data?.overall_accuracy || data?.accuracy_percentage || data?.accuracy_score || getCategoryPercentage(category);
            if (resolvedAcc && resolvedAcc !== "0%") {
                catSummary.overall_accuracy = resolvedAcc;
            } else if (catSummary.total > 0) {
                // Last resort: calculate from matched/total
                catSummary.overall_accuracy = `${Math.round((catSummary.matched / catSummary.total) * 100)}%`;
            } else {
                catSummary.overall_accuracy = "N/A";
            }
        }


        /**
         * Specialized comparison for Calculated Fields (High Fidelity)
         */
        const renderCalculatedFieldComparison = (item: any) => {
            const renderField = (label: string, value: any, isCode = false) => {
                if (value === undefined || value === null || value === "" || value === "N/A" || value === "Missing in Generation") return null;
                return (
                    <div style={{ marginBottom: "12px", display: isCode ? "block" : "flex", alignItems: "baseline", gap: "10px" }}>
                        <Text size={200} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", width: isCode ? "100%" : "85px", flexShrink: 0, marginBottom: isCode ? "6px" : 0, display: "block" }}>{label}</Text>
                        {isCode ? (
                            renderTechnicalContent(String(value), label)
                        ) : (
                            <Text size={200} weight="medium" style={{ color: "var(--text)" }}>{String(value)}</Text>
                        )}
                    </div>
                );
            };

            const sName = item.parsing_name || item.tableau_name || item.source_name || item.name;
            const tName = item.generation_name || item.powerbi_name || item.target_name || item.name;
            const sTable = item.parsing_table || item.tableau_table || item.source_table || item.table;
            const tTable = item.generation_table || item.powerbi_table || item.target_table || item.table;
            const sType = item.parsing_datatype || item.tableau_datatype || item.source_datatype || item.datatype;
            const tType = item.generation_datatype || item.powerbi_datatype || item.target_datatype || item.datatype;

            return (
                <div className={fluentStyles.cardContent}>
                    {/* Metadata Overview Grid removed as per user request */}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                        {/* Tableau Side */}
                        <div className={fluentStyles.sourceBorder} style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--primary)" }}></div>
                                <Text weight="bold" size={200} style={{ color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>TABLEAU EXPRESSION</Text>
                            </div>
                            {renderField("Formula", item.parsing_formula || item.tableau_formula || item.source_formula || item.formula, true)}
                        </div>

                        {/* Power BI Side */}
                        <div className={fluentStyles.targetBorder} style={{ padding: "12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--warning-subtle)" }}></div>
                                <Text weight="bold" size={200} style={{ color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.05em" }}>POWER BI DAX</Text>
                            </div>
                            {renderField("Formula", item.generation_formula || item.powerbi_formula || item.target_formula || item.formula, true)}
                            {/* DAX Query removed as per user request */}
                            {renderField("Actual Values", item.actual_values && item.actual_values !== "SKIPPED - Missing Fabric connection info" ? item.actual_values : null, true)}
                        </div>
                    </div>
                </div>
            );
        };

        /**
         * Specialized item renderer for comparison cards
         */
        const renderDetailItem = (item: any, idx: number, groupName?: string) => {
            const isCalcField = isCalculatedFields || item.parsing_formula !== undefined || item.generation_formula !== undefined;
            const itemNameRaw = item.parsing_visual_name || item.visual_name || item.parsing_name || item.generation_visual_name || item.generation_name || item.parsing_datasource?.name || item.generation_datasource?.name || item.name || item.title || item.rule || item.check ||
                item.table_name || item.id || (category && category.endsWith('s') ? category.slice(0, -1) : (category || "Asset"));

            // Defensive: ensure itemName is always a renderable string/number
            const itemName = (typeof itemNameRaw === 'object' && itemNameRaw !== null) ? JSON.stringify(itemNameRaw) : String(itemNameRaw);

            const accuracy = item.accuracy_percentage ?? item.accuracy ?? item.comparison?.accuracy_percentage ?? item.comparison?.accuracy_score ?? item.accuracy_score;
            const statusRaw = item.status || item.parity_status || item.comparison?.status || (parseFloat(String(accuracy)) >= 100 ? "PASS" : "PARTIAL");
            const status = (typeof statusRaw === 'object' && statusRaw !== null) ? JSON.stringify(statusRaw) : String(statusRaw);

            const reasoningRaw = item.parity_result || item.reasoning || item.comparison?.reason || item.comparison?.reasoning || item.custom_sql_validation?.reasoning;
            const reasoning = (typeof reasoningRaw === 'object' && reasoningRaw !== null) ? JSON.stringify(reasoningRaw) : (reasoningRaw ? String(reasoningRaw) : null);
            const isCustomSql = category.toLowerCase().includes("custom sql") ||
                category.toLowerCase().includes("data query") ||
                category === "Connection Strategy" ||
                nestedKey === "custom_sql_validation" ||
                nestedKey === "custom_sql" ||
                item.custom_sql_query !== undefined ||
                item.mquery_expression !== undefined;

            const isVisuals = (category.toLowerCase().includes("visual") || nestedKey.includes("visual") || item.parsing_visual_type !== undefined);
            const isDatasources = category.toLowerCase().includes("datasource") || nestedKey.includes("datasource");

            return (
                <div key={groupName ? `${groupName}-${idx}` : idx} className={fluentStyles.detailCard}>
                    <div className={fluentStyles.detailHeader}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Text weight="bold" size={400} style={{ color: "var(--text)" }}>
                                {idx + 1}. {itemName}
                            </Text>
                            {item.table && <Badge variant="secondary">{item.table}</Badge>}
                        </div>
                        <div className={fluentStyles.cardActionGroup}>
                            {(accuracy !== undefined && accuracy !== null) && (
                                <Badge
                                    variant={parseFloat(String(accuracy)) >= 100 ? "success" : "warning"}
                                    style={{ fontWeight: 700 }}
                                >
                                    {String(accuracy).includes('%') ? accuracy : `${accuracy}%`}
                                </Badge>
                            )}
                            <Badge variant={getStatusColor("", status)}>
                                {status || "PARTIAL"}
                            </Badge>
                        </div>
                    </div>

                    {isCalcField ? (
                        <div style={{ padding: "8px 0" }}>
                            {renderCalculatedFieldComparison(item)}
                        </div>
                    ) : (
                        <div className={fluentStyles.cardContent} style={isFabric ? { display: "block" } : {}}>
                            {isFabric ? (
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                                    {/* Col 1: Tableau Source */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Source Data in Tableau</Text>
                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Row Count</Text>
                                            <Text weight="bold" size={600} style={{ color: "var(--text)" }}>{item.parsing_row_count ?? item.source_row_count ?? "N/A"}</Text>
                                        </div>
                                    </div>

                                    {/* Col 2: Power BI Target */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Target Data in Power BI</Text>
                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Row Count</Text>
                                            <Text weight="bold" size={600} style={{ color: "var(--text)" }}>{item.fabric_row_count ?? item.target_row_count ?? "N/A"}</Text>
                                        </div>
                                    </div>

                                    {/* Col 3: Deviation */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Deviation</Text>
                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px 20px", display: "flex", justifyContent: "center", alignItems: "center", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                            <div className={parseFloat(item.deviation_percentage || "0") === 0 ? "vl-match-badge" : "vl-diff-badge"} style={{ padding: "6px 24px", fontSize: "14px" }}>
                                                {item.deviation_percentage || "0%"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : isTables ? (
                                (() => {
                                    const sourceObj = { ...(item.parsing_datasource || item.tableau_relationship || item.parsing_data || item.tableau_calc || item.source || item) };
                                    const targetObj = { ...(item.generation_datasource || item.fabric_relationship || item.migration_data || item.powerbi_calc || item.target || item) };

                                    const schemaParity = sourceObj.schema_parity || targetObj.schema_parity || item.schema_parity;
                                    const sourceTableName = sourceObj.table_name || sourceObj.name || item.parsing_name || "N/A";
                                    const targetTableName = targetObj.table_name || targetObj.name || item.generation_name || "N/A";

                                    return (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                            {/* Unified Schema Parity Comparison Container */}
                                            <div style={{ padding: "0px", display: "flex", flexDirection: "column", gap: "20px" }}>
                                                {/* MIDDLE: 3-COLUMN SCHEMA METRICS */}
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                                                    {/* Col 1: Tableau Source */}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Source Data in Tableau</Text>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)` }}>
                                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Column Count</Text>
                                                            <Text weight="bold" size={600} style={{ color: "var(--text)" }}>{schemaParity.parsing_column_count ?? "0"}</Text>
                                                        </div>
                                                    </div>

                                                    {/* Col 2: Power BI Target */}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Target Data in Power BI</Text>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)` }}>
                                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Column Count</Text>
                                                            <Text weight="bold" size={600} style={{ color: "var(--text)" }}>{schemaParity.generation_column_count ?? "0"}</Text>
                                                        </div>
                                                    </div>

                                                    {/* Col 3: Status */}
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                                        <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Status</Text>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px 20px", display: "flex", justifyContent: "center", alignItems: "center", border: `1px solid var(--border)` }}>
                                                            <Badge
                                                                variant={(schemaParity.column_count_match === true || String(schemaParity.column_count_match).toLowerCase() === "true" || schemaParity.column_count_match === "MATCHED" || schemaParity.column_count_match === "PASS") ? "success" : "warning"}
                                                                style={{ 
                                                                    padding: "6px 24px", 
                                                                    borderRadius: "20px", 
                                                                    fontWeight: "bold",
                                                                    border: `1px solid var(--success)`,
                                                                    color: "var(--success)",
                                                                    fontSize: "14px"
                                                                }}
                                                            >
                                                                {(schemaParity.column_count_match === true || String(schemaParity.column_count_match).toLowerCase() === "true" || schemaParity.column_count_match === "MATCHED" || schemaParity.column_count_match === "PASS") ? "PASS" : "FAIL"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* BOTTOM: DATATYPE AUDIT STRIP WITH SUB-CARDS */}
                                                <div style={{ 
                                                    padding: "20px", 
                                                    background: "var(--surface-subtle)", 
                                                    borderRadius: "12px", 
                                                    border: `1px solid var(--border)`,
                                                    marginTop: "10px"
                                                }}>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", background: "var(--surface)", border: `1px solid var(--border)` }}>
                                                            <Text size={100} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Datatype Matched</Text>
                                                            <Text weight="bold" size={600} style={{ color: "var(--success)" }}>{schemaParity.datatype_matches ?? "0"}</Text>
                                                        </div>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", background: "var(--surface)", border: `1px solid var(--border)` }}>
                                                            <Text size={100} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Datatype Mismatched</Text>
                                                            <Text weight="bold" size={600} style={{ color: "var(--warning)" }}>{schemaParity.datatype_mismatches ?? "0"}</Text>
                                                        </div>
                                                        <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", background: "var(--surface)", border: `1px solid var(--border)` }}>
                                                            <Text size={100} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "8px" }}>Datatype Accuracy</Text>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <Text weight="bold" size={600} style={{ color: "var(--text)" }}>{schemaParity.column_datatype_accuracy ?? item.accuracy_percentage ?? "100%"}</Text>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* FULL WIDTH LISTS (e.g. Columns) */}
                                            <div>
                                                {/* Target Lists (Columns etc.) */}
                                                {!isCustomSql && renderObjectProperties("", {
                                                    ...(item.generation_datasource || item.fabric_relationship || item.migration_data || item.powerbi_calc || item.target || item),
                                                    generation_join_keys: item.generation_join_keys
                                                }, "target", "lists")}
                                            </div>
                                        </div>
                                    );
                                })()
                            ) : isVisuals ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                                        {/* Col 1: Tableau Source */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Source Visual in Tableau</Text>
                                            <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Visual Type</Text>
                                                <Text weight="bold" size={400} style={{ color: "var(--text)" }}>{item.schema_validation?.visual_type?.parsing ?? item.parsing_visual_type ?? item.source_visual_type ?? "N/A"}</Text>
                                                {item.sheet_name && <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-word" }}>Sheet: {item.sheet_name}</Text>}
                                                {item.schema_validation?.visual_type?.sub_visual_types && (
                                                    <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                                        {item.schema_validation.visual_type.sub_visual_types.map((sub: any, sIdx: number) => (
                                                            <Text key={sIdx} size={100} style={{ color: "var(--text-muted)" }}>• {sub.field}: {sub.type}</Text>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Col 2: Power BI Target */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Target Visual in Power BI</Text>
                                            <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Visual Type</Text>
                                                <Text weight="bold" size={400} style={{ color: "var(--text)" }}>{item.schema_validation?.visual_type?.generation ?? item.generation_visual_type ?? item.target_visual_type ?? "N/A"}</Text>
                                                {item.generation_visual_name && <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-word" }}>{item.generation_visual_name}</Text>}
                                            </div>
                                        </div>

                                        {/* Col 3: Item Accuracy */}
                                        {(() => {
                                            const itemAcc = item.accuracy_percentage ?? item.accuracy ?? accuracy;
                                            const accNum = parseFloat(String(itemAcc || "0"));
                                            const accStr = itemAcc ? (String(itemAcc).includes('%') ? String(itemAcc) : `${itemAcc}%`) : "0%";
                                            return (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                                    <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Accuracy</Text>
                                                    <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px 20px", display: "flex", justifyContent: "center", alignItems: "center", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                        <div className={accNum >= 100 ? "vl-match-badge" : "vl-diff-badge"} style={{ padding: "6px 24px", fontSize: "14px" }}>
                                                            {accStr}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    
                                    {/* ── DATA COMPARISON: vs-card layout ── */}
                                    {(() => {
                                        const sourceRows: any[] = Array.isArray(item.source_data) ? item.source_data : [];
                                        const actualRows: any[] = Array.isArray(item.actual_values) ? item.actual_values : [];
                                        if (sourceRows.length === 0 && actualRows.length === 0) return null;

                                        const cleanKey = (k: string) =>
                                            k.replace(/^\[|\]$/g, '').replace(/^[a-zA-Z_]+\[/, '').replace(/\]$/, '');

                                        const normalizeKey = (k: string) => {
                                             const cleaned = cleanKey(k).toLowerCase()
                                                 .replace(/^(count|sum|avg|average|distinct count|max|min|year|month|day) of\s+/i, '')
                                                 .trim();
                                             return cleaned.replace(/[^a-z0-9]/g, '');
                                         };

                                        const numRows = Math.min(Math.max(sourceRows.length, actualRows.length), 10);

                                        return (
                                            <div style={{ marginTop: "4px" }}>
                                                <Text weight="bold" size={200} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "16px" }}>
                                                    Data Comparison — Tableau vs Power BI
                                                </Text>

                                                {/* ONE TABLE for the whole visual, grouped by fields */}
                                                <div style={{ backgroundColor: "var(--surface)", border: `1px solid var(--border)`, borderRadius: "12px", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                                                    {(() => {
                                                        const srcRow0 = sourceRows[0] ?? null;
                                                        const actRow0 = actualRows[0] ?? null;

                                                        const tryFormatNumber = (val: any) => {
                                                            const strVal = val === null || val === undefined ? "null" : String(val);
                                                            if (!isNaN(Number(strVal)) && !isNaN(parseFloat(strVal)) && strVal.trim() !== "") {
                                                                const num = Number(strVal);
                                                                if (num % 1 !== 0) {
                                                                    return num.toFixed(2);
                                                                }
                                                            }
                                                            return strVal;
                                                        };

                                                        // Helper to compare values strictly after stripping commas/spaces
                                                         const compareValues = (v1: any, v2: any) => {
                                                             const s1 = String(v1 || '').replace(/,/g, '').trim().toLowerCase();
                                                             const s2 = String(v2 || '').replace(/,/g, '').trim().toLowerCase();
                                                             if (!s1 || !s2) return s1 === s2;
                                                             if (s1 === s2) return true;
                                                             const f1 = parseFloat(s1);
                                                             const f2 = parseFloat(s2);
                                                             if (!isNaN(f1) && !isNaN(f2)) {
                                                                 return Math.abs(f1 - f2) < 0.001;
                                                             }
                                                             return false;
                                                         };

                                                         const rowValueNames = new Set<string>();
                                                         const allRowsForNameScan = [...sourceRows, ...actualRows];
                                                         for (const row of allRowsForNameScan) {
                                                             if (!row) continue;
                                                             for (const [rk, rv] of Object.entries(row)) {
                                                                 if (typeof rv === "string") {
                                                                     const cleanVal = rv.replace(/,/g, '').trim();
                                                                     // Skip numeric strings to avoid false matches
                                                                     if (cleanVal === "" || (!isNaN(Number(cleanVal)) && !isNaN(parseFloat(cleanVal)))) {
                                                                         continue;
                                                                     }
                                                                     rowValueNames.add(rv.toLowerCase().trim());
                                                                     rowValueNames.add(cleanKey(rv).toLowerCase().trim());
                                                                 }
                                                             }
                                                         }

                                                         const sourceKeysClean = new Set<string>();
                                                         if (sourceRows.length > 0 && sourceRows[0]) {
                                                             for (const k of Object.keys(sourceRows[0])) {
                                                                 sourceKeysClean.add(cleanKey(k).toLowerCase().trim());
                                                             }
                                                         }

                                                         const isExcludedKey = (key: string) => {
                                                             const cleanK = cleanKey(key).toLowerCase().trim();
                                                             // If this key is explicitly in source_data, don't exclude it
                                                             if (sourceKeysClean.size > 0 && sourceKeysClean.has(cleanK)) {
                                                                 return false;
                                                             }
                                                             return rowValueNames.has(cleanK);
                                                         };

                                                        const alignedFields: Array<{srcKey: string|null, actKey: string|null}> = [];
                                                        const actKeysUsed = new Set<string>();

                                                        if (srcRow0) {
                                                            const actKeys = actRow0 ? Object.keys(actRow0) : [];

                                                            for (const [sKey, sVal] of Object.entries(srcRow0)) {
                                                                const cleanSKey = cleanKey(sKey);
                                                                if (/^match$/i.test(cleanSKey) || sKey.startsWith("_")) continue;
                                                                
                                                                const sKeyNorm = normalizeKey(sKey);
                                                                
                                                                // 1. Try match by clean name
                                                                 let matchKey = actKeys.find(aKey => !actKeysUsed.has(aKey) && !isExcludedKey(aKey) && cleanKey(aKey).toLowerCase() === cleanSKey.toLowerCase());
                                                                 
                                                                 // 2. Try match by normalized name (stripping prefixes and non-alphanumeric chars)
                                                                 if (!matchKey) {
                                                                     matchKey = actKeys.find(aKey => !actKeysUsed.has(aKey) && !isExcludedKey(aKey) && normalizeKey(aKey) === sKeyNorm);
                                                                 }
                                                                 
                                                                 // 3. Try match by value on row 0 (robust numeric check)
                                                                 if (!matchKey) {
                                                                     matchKey = actKeys.find(aKey => !actKeysUsed.has(aKey) && !isExcludedKey(aKey) && !/^match$/i.test(cleanKey(aKey)) && !aKey.startsWith("_") && compareValues(sVal, actRow0[aKey]));
                                                                 }

                                                                if (matchKey) {
                                                                    alignedFields.push({ srcKey: sKey, actKey: matchKey });
                                                                    actKeysUsed.add(matchKey);
                                                                } else {
                                                                    alignedFields.push({ srcKey: sKey, actKey: null });
                                                                }
                                                            }
                                                        }

                                                        if (actRow0) {
                                                             for (const [aKey] of Object.entries(actRow0)) {
                                                                 if (actKeysUsed.has(aKey) || /^match$/i.test(cleanKey(aKey)) || aKey.startsWith("_") || isExcludedKey(aKey)) {
                                                                     continue;
                                                                 }
                                                                 alignedFields.push({ srcKey: null, actKey: aKey });
                                                             }
                                                         }

                                                        if (alignedFields.length === 0) {
                                                            return (
                                                                <div style={{ padding: "16px", textAlign: "center" }}>
                                                                    <Text size={200} style={{ color: "var(--text-muted)" }}>No field data available</Text>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                                                                <div style={{ display: "flex", border: `1px solid var(--border)`, borderRadius: "12px", overflow: "hidden", boxShadow: "var(--shadow-sm)", backgroundColor: "var(--surface)" }}>
                                                                    
                                                                    {/* ── TABLEAU SECTION ── */}
                                                                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: `1px solid var(--border)`, position: "relative" }}>
                                                                        <div style={{ padding: "14px", textAlign: "center", backgroundColor: "var(--surface-subtle)", borderBottom: `2px solid var(--border)`, height: "48px", boxSizing: "border-box" }}>
                                                                            <Text size={300} weight="bold" style={{ color: "#0f6cbd", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tableau</Text>
                                                                        </div>
                                                                        
                                                                        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                                                                            {/* Left Navigation Zone */}
                                                                            {alignedFields.length > 2 && (
                                                                                <div style={{ position: "absolute", left: 0, top: "1px", height: "40px", width: "40px", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "4px", background: `linear-gradient(to right, var(--surface-subtle) 60%, transparent)` }}>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        style={{ minWidth: "24px", height: "32px", padding: 0 }}
                                                                                        onClick={() => document.getElementById(`scroll-t-${idx}`)?.scrollBy({ left: -250, behavior: "smooth" })}
                                                                                    ><ChevronLeft style={{ fontSize: "18px", color: "#0f6cbd" }} /></Button>
                                                                                </div>
                                                                            )}

                                                                            <div id={`scroll-t-${idx}`} style={{ overflowX: "auto", paddingBottom: "4px", scrollBehavior: "smooth" }}>
                                                                                <div style={{ width: "max-content", minWidth: "100%" }}>
                                                                                    {/* Field Headers */}
                                                                                    <div style={{ display: "grid", gridTemplateColumns: alignedFields.length > 2 ? `repeat(${alignedFields.length}, 50%)` : `repeat(${alignedFields.length}, 1fr)`, borderBottom: `1px solid var(--border)`, borderTop: `1px solid var(--border)`, height: "42px", boxSizing: "border-box" }}>
                                                                                        {alignedFields.map((field, fIdx) => (
                                                                                            <div key={`th-t-${fIdx}`} style={{ padding: "10px 16px", borderRight: fIdx < alignedFields.length - 1 ? `1px solid var(--border)` : "none", backgroundColor: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                                                <Text size={100} weight="bold" style={{ color: "var(--text)", textTransform: "uppercase", fontSize: "10px", textAlign: "center" }}>{field.srcKey ? cleanKey(field.srcKey) : "—"}</Text>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    {/* Rows */}
                                                                                    {Array.from({ length: numRows }, (_, rowIdx) => {
                                                                                        const srcRow = sourceRows[rowIdx] ?? null;
                                                                                        return (
                                                                                            <div key={`tr-t-${rowIdx}`} style={{ display: "grid", gridTemplateColumns: alignedFields.length > 2 ? `repeat(${alignedFields.length}, 50%)` : `repeat(${alignedFields.length}, 1fr)`, borderBottom: `1px solid var(--border)`, height: "52px", boxSizing: "border-box" }}>
                                                                                                {alignedFields.map((field, fIdx) => {
                                                                                                    const val = srcRow && field.srcKey ? srcRow[field.srcKey] : undefined;
                                                                                                    return (
                                                                                                        <div key={`td-t-${fIdx}`} style={{ padding: "8px 16px", borderRight: fIdx < alignedFields.length - 1 ? `1px solid var(--border)` : "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                                                                                                            <Text size={200} style={{ color: "var(--text)", fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.2", textAlign: "center" }}>{val === undefined || field.srcKey === null ? "—" : tryFormatNumber(val)}</Text>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>

                                                                            {/* Right Navigation Zone */}
                                                                            {alignedFields.length > 2 && (
                                                                                <div style={{ position: "absolute", right: 0, top: "1px", height: "40px", width: "40px", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px", background: `linear-gradient(to left, var(--surface-subtle) 60%, transparent)` }}>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        style={{ minWidth: "24px", height: "32px", padding: 0 }}
                                                                                        onClick={() => document.getElementById(`scroll-t-${idx}`)?.scrollBy({ left: 250, behavior: "smooth" })}
                                                                                    ><ChevronRight style={{ fontSize: "18px", color: "#0f6cbd" }} /></Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* ── POWER BI SECTION ── */}
                                                                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", borderRight: `1px solid var(--border)`, position: "relative" }}>
                                                                        <div style={{ padding: "14px", textAlign: "center", backgroundColor: "var(--surface-subtle)", borderBottom: `2px solid var(--border)`, height: "48px", boxSizing: "border-box" }}>
                                                                            <Text size={300} weight="bold" style={{ color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Power BI</Text>
                                                                        </div>
                                                                        
                                                                        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                                                                            {/* Left Navigation Zone */}
                                                                            {alignedFields.length > 2 && (
                                                                                <div style={{ position: "absolute", left: 0, top: "1px", height: "40px", width: "40px", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "4px", background: `linear-gradient(to right, var(--surface-subtle) 60%, transparent)` }}>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        style={{ minWidth: "24px", height: "32px", padding: 0 }}
                                                                                        onClick={() => document.getElementById(`scroll-p-${idx}`)?.scrollBy({ left: -250, behavior: "smooth" })}
                                                                                    ><ChevronLeft style={{ fontSize: "18px", color: "#f59e0b" }} /></Button>
                                                                                </div>
                                                                            )}

                                                                            <div id={`scroll-p-${idx}`} style={{ overflowX: "auto", paddingBottom: "4px", scrollBehavior: "smooth" }}>
                                                                                <div style={{ width: "max-content", minWidth: "100%" }}>
                                                                                    {/* Field Headers */}
                                                                                    <div style={{ display: "grid", gridTemplateColumns: alignedFields.length > 2 ? `repeat(${alignedFields.length}, 50%)` : `repeat(${alignedFields.length}, 1fr)`, borderBottom: `1px solid var(--border)`, borderTop: `1px solid var(--border)`, height: "42px", boxSizing: "border-box" }}>
                                                                                        {alignedFields.map((field, fIdx) => (
                                                                                            <div key={`th-p-${fIdx}`} style={{ padding: "10px 16px", borderRight: fIdx < alignedFields.length - 1 ? `1px solid var(--border)` : "none", backgroundColor: "var(--surface-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                                                <Text size={100} weight="bold" style={{ color: "var(--text)", textTransform: "uppercase", fontSize: "10px", textAlign: "center" }}>{field.actKey ? cleanKey(field.actKey) : "—"}</Text>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    {/* Rows */}
                                                                                    {Array.from({ length: numRows }, (_, rowIdx) => {
                                                                                        const actRow = actualRows[rowIdx] ?? null;
                                                                                        return (
                                                                                            <div key={`tr-p-${rowIdx}`} style={{ display: "grid", gridTemplateColumns: alignedFields.length > 2 ? `repeat(${alignedFields.length}, 50%)` : `repeat(${alignedFields.length}, 1fr)`, borderBottom: `1px solid var(--border)`, height: "52px", boxSizing: "border-box" }}>
                                                                                                {alignedFields.map((field, fIdx) => {
                                                                                                    const val = actRow && field.actKey ? actRow[field.actKey] : undefined;
                                                                                                    return (
                                                                                                        <div key={`td-p-${fIdx}`} style={{ padding: "8px 16px", borderRight: fIdx < alignedFields.length - 1 ? `1px solid var(--border)` : "none", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                                                                                                            <Text size={200} style={{ color: "var(--text)", fontWeight: 500, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.2", textAlign: "center" }}>{val === undefined || field.actKey === null ? "—" : tryFormatNumber(val)}</Text>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>

                                                                            {/* Right Navigation Zone */}
                                                                            {alignedFields.length > 2 && (
                                                                                <div style={{ position: "absolute", right: 0, top: "1px", height: "40px", width: "40px", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px", background: `linear-gradient(to left, var(--surface-subtle) 60%, transparent)` }}>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        style={{ minWidth: "24px", height: "32px", padding: 0 }}
                                                                                        onClick={() => document.getElementById(`scroll-p-${idx}`)?.scrollBy({ left: 250, behavior: "smooth" })}
                                                                                    ><ChevronRight style={{ fontSize: "18px", color: "#f59e0b" }} /></Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* ── STATUS SECTION ── */}
                                                                    <div style={{ width: "100px", display: "flex", flexDirection: "column" }}>
                                                                        <div style={{ padding: "14px", textAlign: "center", backgroundColor: "var(--surface-subtle)", borderBottom: `2px solid var(--border)`, height: "48px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                                            <Text size={200} weight="bold" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</Text>
                                                                        </div>
                                                                        <div style={{ height: "42px", backgroundColor: "var(--surface-subtle)", borderBottom: `1px solid var(--border)`, borderTop: `1px solid var(--border)` }}></div>
                                                                        {Array.from({ length: numRows }, (_, rowIdx) => {
                                                                            const srcRow = sourceRows[rowIdx] ?? null;
                                                                            const actRow = actualRows[rowIdx] ?? null;
                                                                            if (!srcRow && !actRow) return <div key={`st-${rowIdx}`} style={{ height: "52px", backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#fafafa", borderBottom: rowIdx < numRows - 1 ? `1px solid var(--border)` : "none" }}></div>;

                                                                            const rowMatchRaw = actRow && (actRow.match || actRow.status);
                                                                            let isPass = true;
                                                                            if (rowMatchRaw) {
                                                                                isPass = (String(rowMatchRaw).toUpperCase() === "PASS" || String(rowMatchRaw).toUpperCase() === "SUCCESS");
                                                                            } else {
                                                                                isPass = alignedFields.every(field => {
                                                                                    const sVal = srcRow && field.srcKey ? srcRow[field.srcKey] : undefined;
                                                                                    const aVal = actRow && field.actKey ? actRow[field.actKey] : undefined;
                                                                                    return compareValues(sVal, aVal);
                                                                                });
                                                                            }

                                                                            return (
                                                                                <div key={`st-${rowIdx}`} style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "center", height: "52px", boxSizing: "border-box", borderBottom: `1px solid var(--border)`, backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                                                                                    <div className={isPass ? "vl-match-badge" : "vl-diff-badge"} style={{ fontSize: "11px", padding: "4px 12px", borderRadius: "100px", fontWeight: "bold" }}>
                                                                                        {isPass ? "PASS" : "FAIL"}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {Math.max(sourceRows.length, actualRows.length) > 10 && (
                                                    <Text size={100} style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", display: "block", marginTop: "10px" }}>
                                                        + {Math.max(sourceRows.length, actualRows.length) - 10} more rows not shown
                                                    </Text>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Sub-properties list (details array in visuals) */}
                                    {item.details && Array.isArray(item.details) && item.details.length > 0 && (
                                        <div style={{ marginTop: "10px" }}>
                                            <Text weight="bold" size={200} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "12px" }}>Visual Property Audit ({item.details.length})</Text>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                {item.details.map((prop: any, pIdx: number) => (
                                                    <div key={pIdx} style={{ padding: "12px 16px", backgroundColor: "var(--surface)", border: `1px solid var(--border)`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                                                            <Badge variant="secondary">{pIdx + 1}</Badge>
                                                            <div style={{ display: "flex", flexDirection: "column" }}>
                                                                <Text weight="bold" size={200}>{prop.property || "Property"}</Text>
                                                                <div style={{ display: "flex", gap: "12px", marginTop: "2px" }}>
                                                                    <Text size={100} style={{ color: "var(--text-muted)" }}>S: {String(prop.parsing_value || prop.source_value || "N/A")}</Text>
                                                                    <Text size={100} style={{ color: "var(--text-muted)" }}>T: {String(prop.generation_value || prop.target_value || "N/A")}</Text>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Badge variant={parseFloat(String(prop.accuracy_percentage || "0")) >= 100 ? "success" : "warning"}>
                                                            {prop.accuracy_percentage || "0%"}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isDatasources ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                                        {/* Col 1: Tableau Source */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Source Connection in Tableau</Text>
                                            <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Type / Mode</Text>
                                                <Text weight="bold" size={400} style={{ color: "var(--text)" }}>{item.parsing_datasource?.connection_type ?? "N/A"} ({item.parsing_datasource?.mode ?? "N/A"})</Text>
                                                <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                                    <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>Srv: {item.parsing_datasource?.server ?? "N/A"}</Text>
                                                    <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>DB: {item.parsing_datasource?.database ?? "N/A"}</Text>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Col 2: Power BI Target */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Target Connection in Power BI</Text>
                                            <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "8px", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Type / Mode</Text>
                                                <Text weight="bold" size={400} style={{ color: "var(--text)" }}>{item.generation_datasource?.connection_type ?? "N/A"} ({item.generation_datasource?.mode ?? "N/A"})</Text>
                                                <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                                    <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>Srv: {item.generation_datasource?.server ?? "N/A"}</Text>
                                                    <Text size={100} style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>DB: {item.generation_datasource?.database ?? "N/A"}</Text>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Col 3: Accuracy */}
                                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
                                            <Text weight="bold" size={100} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Accuracy</Text>
                                            <div className={fluentStyles.detailCard} style={{ flex: 1, padding: "16px 20px", display: "flex", justifyContent: "center", alignItems: "center", border: `1px solid var(--border)`, background: "var(--surface-subtle)" }}>
                                                <Badge
                                                    variant={parseFloat(String(accuracy || "0")) >= 100 ? "success" : "warning"}
                                                    style={{
                                                        padding: "6px 24px", 
                                                        borderRadius: "20px", 
                                                        fontWeight: "bold",
                                                        border: parseFloat(String(accuracy || "0")) >= 100 ? `1px solid var(--success)` : `1px solid var(--warning)`,
                                                        color: parseFloat(String(accuracy || "0")) >= 100 ? "var(--success)" : "var(--warning)",
                                                        fontSize: "14px"
                                                    }}
                                                >
                                                    {accuracy ? (String(accuracy).includes('%') ? accuracy : `${accuracy}%`) : "0%"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Parameter Tables / Components Audit */}
                                    {item.validation_result?.parameter_tables && Array.isArray(item.validation_result.parameter_tables) && item.validation_result.parameter_tables.length > 0 && (
                                        <div style={{ marginTop: "10px" }}>
                                            <Text weight="bold" size={200} style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "12px" }}>Component & Parameter Audit ({item.validation_result.parameter_tables.length})</Text>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                {item.validation_result.parameter_tables.map((param: any, pIdx: number) => (
                                                    <div key={pIdx} style={{ 
                                                        padding: "12px 16px", 
                                                        backgroundColor: "var(--surface)", 
                                                        border: `1px solid var(--border)`, 
                                                        borderRadius: "8px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: "8px"
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                                <Badge variant="secondary">{pIdx + 1}</Badge>
                                                                <Text weight="bold" size={200}>{param.table_name || param.source_parameter_name || "Component"}</Text>
                                                            </div>
                                                            <Badge variant="secondary">{param.datatype ?? "N/A"}</Badge>
                                                        </div>
                                                        <div style={{ paddingLeft: "32px", borderLeft: `2px solid var(--border)`, marginLeft: "8px" }}>
                                                            <Text size={100} italic style={{ color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>&quot;{param.reasoning || "Component mapping confirmed."}&quot;</Text>
                                                            <div style={{ display: "flex", gap: "12px" }}>
                                                                <Text size={100} weight="semibold">Value: {String(param.current_value || "N/A")}</Text>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Tables & Lists Audit for Datasources */}
                                    <div style={{ 
                                        marginTop: "12px", 
                                        display: "grid", 
                                        gridTemplateColumns: "1fr 1fr", 
                                        gap: "24px" 
                                    }}>
                                        <div className={fluentStyles.sourceBorder} style={{ padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px" }}>
                                            {renderObjectProperties("", item.parsing_datasource, "source", "lists")}
                                        </div>
                                        <div className={fluentStyles.targetBorder} style={{ padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px" }}>
                                            {renderObjectProperties("", item.generation_datasource, "target", "lists")}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                                        {/* SOURCE CARD */}
                                        <div className={fluentStyles.sourceBorder} style={{ padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px", border: `1px solid var(--border)` }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                                                <Text weight="bold" size={200} style={{ color: "var(--primary)" }}>SOURCE DATA IN TABLEAU</Text>
                                            </div>
                                            {isCustomSql ? (
                                                (() => {
                                                    const sql = item.sqlQuery || item.query || item.custom_sql_query || item.parsing_data?.custom_sql_query || item.source?.custom_sql_query || item.sql || item.parsing_sql || item.parsing_data?.sql || "N/A";
                                                    return renderObjectProperties("", { "Custom SQL Query": sql }, "source", "properties");
                                                })()
                                            ) : (
                                                renderObjectProperties(item.parsing_name || "", {
                                                    ...(item.parsing_datasource || item.tableau_relationship || item.parsing_data || item.tableau_calc || item.source || item),
                                                    parsing_join_keys: item.parsing_join_keys
                                                }, "source", "properties")
                                            )}
                                        </div>

                                        {/* TARGET CARD */}
                                        <div className={fluentStyles.targetBorder} style={{ padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px", border: `1px solid var(--border)` }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                                                <Text weight="bold" size={200} style={{ color: "var(--warning)" }}>TARGET DATA IN POWER BI</Text>
                                            </div>
                                            {isCustomSql ? (
                                                (() => {
                                                    // mquery_expression is the actual backend field name
                                                    const rawMQuery = item.mquery_expression || item.mQuerySteps || item.m_query || item.mQuery || item.mquery || "N/A";

                                                    let finalMQuery = rawMQuery;

                                                    // Handle stringified JSON
                                                    if (typeof rawMQuery === 'string' && (rawMQuery.startsWith('[') || rawMQuery.startsWith('{'))) {
                                                        try { finalMQuery = JSON.parse(rawMQuery); } catch (e) { }
                                                    }

                                                    // Handle array of steps
                                                    if (Array.isArray(finalMQuery)) {
                                                        finalMQuery = finalMQuery.map((s: any) =>
                                                            typeof s === 'string' ? s : (s.content || s.step_content || JSON.stringify(s))
                                                        ).join('\n');
                                                    }

                                                    return renderObjectProperties("", { "MQuery": finalMQuery }, "target", "properties");
                                                })()
                                            ) : (
                                                renderObjectProperties(item.generation_name || "", {
                                                    ...(item.generation_datasource || item.fabric_relationship || item.migration_data || item.powerbi_calc || item.target || item),
                                                    generation_join_keys: item.generation_join_keys
                                                }, "target", "properties")
                                            )}
                                        </div>
                                    </div>

                                    {/* LISTS SECTION (e.g. Tables, Columns) - Skip for relationships as they are handled inside cards */}
                                    {(!isRelationships || isDatasources) && (
                                        <div style={{ 
                                            marginTop: "12px", 
                                            display: isDatasources ? "grid" : "block", 
                                            gridTemplateColumns: isDatasources ? "1fr 1fr" : "1fr", 
                                            gap: "24px"
                                        }}>
                                            {/* Source Lists */}
                                            <div className={isDatasources ? fluentStyles.sourceBorder : ""} style={isDatasources ? { padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px" } : {}}>
                                                {!isCustomSql && renderObjectProperties("", {
                                                    ...(item.parsing_datasource || item.tableau_relationship || item.parsing_data || item.tableau_calc || item.source || item),
                                                    parsing_join_keys: item.parsing_join_keys
                                                }, "source", "lists")}
                                            </div>

                                            {/* Target Lists */}
                                            <div className={isDatasources ? fluentStyles.targetBorder : ""} style={isDatasources ? { padding: "16px", background: "var(--surface-subtle)", borderRadius: "12px" } : {}}>
                                                {!isCustomSql && renderObjectProperties("", {
                                                    ...(item.generation_datasource || item.fabric_relationship || item.migration_data || item.powerbi_calc || item.target || item),
                                                    generation_join_keys: item.generation_join_keys
                                                }, "target", "lists")}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {reasoning && (
                        <div className={fluentStyles.insightBox} style={{ marginTop: "16px", borderLeft: `4px solid var(--success)` }}>
                            <div className={fluentStyles.sectionLabel} style={{ color: "var(--success)" }}>
                                <BrainCircuit style={{ fontSize: "14px", marginRight: "4px" }} /> Validation Status
                            </div>
                            <Text size={200} className={fluentStyles.insightText} style={{ lineHeight: "1.6", color: "var(--text-secondary)", fontWeight: 500 }}>
                                {reasoning}
                            </Text>
                        </div>
                    )}

                </div>
            );
        };

        return (
            <div className={fluentStyles.dialogContent}>
                {/* Summary Scorecard for Calculated Fields and Relationships */}
                {catSummary && (
                    <div className="vl-metrics-grid vl-metrics-grid-validation" style={{ marginBottom: "32px", width: "100%" }}>
                        <div className="vl-metric-card">
                            <div className="vl-metric-value">
                                {catSummary.total ?? (details.length > 0 ? details.length : 0)}
                            </div>
                            <div className="vl-metric-label">TOTAL ITEMS</div>
                        </div>
                        <div className="vl-metric-card">
                            <div className="vl-metric-value" style={{ 
                                color: (catSummary.overall_accuracy === "N/A") ? "var(--text-muted)" : "var(--success)" 
                            }}>
                                {(() => {
                                    const acc = catSummary.overall_accuracy;
                                    if (!acc || acc === "N/A") return "N/A";
                                    return String(acc).includes('%') ? acc : `${acc}%`;
                                })()}
                            </div>
                            <div className="vl-metric-label">ACCURACY</div>
                        </div>

                        {/* Extended metrics for Calculated Fields */}
                        {isCalculatedFields && (
                            <>
                                <div className="vl-metric-card">
                                    <div className="vl-metric-value">{catSummary.total_measures ?? 0}</div>
                                    <div className="vl-metric-label">MEASURES</div>
                                </div>
                                <div className="vl-metric-card">
                                    <div className="vl-metric-value">{catSummary.total_dimensions ?? 0}</div>
                                    <div className="vl-metric-label">DIMENSIONS</div>
                                </div>
                                <div className="vl-metric-card">
                                    <div className="vl-metric-value">{catSummary.total_lods ?? 0}</div>
                                    <div className="vl-metric-label">LOD EXPRESSIONS</div>
                                </div>
                                <div className="vl-metric-card">
                                    <div className="vl-metric-value">{catSummary.total_table_calculations ?? 0}</div>
                                    <div className="vl-metric-label">TABLE CALCULATIONS</div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Name Reconciliation Table - Enabled for Tables if data exists */}
                {(isTables || category === "Tables" || category === "Table") && nameReconciliation}

                {/* Detailed Comparison - Vertical Card Layout */}
                {true && (
                    <div className={fluentStyles.comparisonGroup}>
                        {finalGroups && typeof finalGroups === 'object' ? (
                            <div className={fluentStyles.comparisonGroup}>
                                <Text weight="bold" size={400} className={fluentStyles.comparisonTitle}>
                                    Detailed Comparison
                                </Text>
                                <div className={fluentStyles.categoryList}>
                                    {(() => {
                                        // Specific categories requested by the user
                                        const calculationCategories = [
                                            { key: "measures", label: "Measures" },
                                            { key: "dimensions", label: "Dimensions" },
                                            { key: "lods", label: "LOD Expressions" },
                                            { key: "table_calculations", label: "Table Calculations" }
                                        ];

                                        if (isCalculatedFields) {
                                            return calculationCategories.map((cat, idx) => {
                                                const groupItems = finalGroups?.[cat.key] || [];
                                                // First item (Measures) open by default, others closed
                                                const isCollapsed = collapsedGroups[cat.key] !== undefined
                                                    ? collapsedGroups[cat.key]
                                                    : (idx !== 0);

                                                return (
                                                    <div key={cat.key} style={{ marginBottom: "12px" }}>
                                                        <div
                                                            className={fluentStyles.groupHeader}
                                                            onClick={() => toggleGroup(cat.key, isCollapsed)}
                                                            role="button"
                                                            aria-expanded={!isCollapsed}
                                                        >
                                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                                                                <Text className={fluentStyles.groupTitle}>{cat.label}</Text>
                                                                <Badge variant="secondary">{groupItems.length}</Badge>
                                                            </div>
                                                            {isCollapsed ? <ChevronDown /> : <ChevronUp />}
                                                        </div>

                                                        {!isCollapsed && (
                                                            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                                                                {groupItems.length > 0 ? (
                                                                    groupItems.map((item: any, idx: number) => renderDetailItem(item, idx, cat.label))
                                                                ) : (
                                                                    <div style={{ padding: "16px", textAlign: "center", background: "var(--muted)", borderRadius: "8px" }}>
                                                                        <Text size={200} style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No items found in this category</Text>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        }

                                        // Fallback for other categories
                                        return Object.entries(finalGroups).map(([groupName, groupItems]: [string, any], idx: number) => {
                                            if (!Array.isArray(groupItems) || groupItems.length === 0) return null;
                                            // First item open by default, others closed
                                            const isCollapsed = collapsedGroups[groupName] !== undefined
                                                ? collapsedGroups[groupName]
                                                : (idx !== 0);

                                            return (
                                                <div key={groupName} style={{ marginBottom: "12px" }}>
                                                    <div
                                                        className={fluentStyles.groupHeader}
                                                        onClick={() => toggleGroup(groupName, isCollapsed)}
                                                        role="button"
                                                        aria-expanded={!isCollapsed}
                                                    >
                                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                                                            <Text className={fluentStyles.groupTitle}>{groupName.replace(/_/g, " ")}</Text>
                                                            <Badge variant="secondary">{groupItems.length}</Badge>
                                                        </div>
                                                        {isCollapsed ? <ChevronDown /> : <ChevronUp />}
                                                    </div>

                                                    {!isCollapsed && (
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "12px" }}>
                                                            {groupItems.map((item: any, idx: number) => renderDetailItem(item, idx, groupName))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        ) : (details.length > 0) ? (
                            <div className={fluentStyles.comparisonGroup}>
                                <Text weight="bold" size={400} className={fluentStyles.comparisonTitle}>
                                    Detailed Comparison
                                </Text>

                                {details.map((item: any, idx: number) => renderDetailItem(item, idx))}
                            </div>
                        ) : (
                            <div className={fluentStyles.emptyState}>
                                <Text italic style={{ color: "var(--text-muted)", display: "block" }}>
                                    {category === "Custom SQL" ? "No Custom SQL queries were detected or selected for validation in this workbook." : "No detailed comparison results found for this category."}
                                </Text>
                            </div>
                        )}
                    </div>
                )}

                {/* Generic object detail - only if not already handled by specialized views (reconciliation or groups) */}
                {!Array.isArray(data) && data && !data.details && !data.groups && typeof data === 'object' && (
                    <div className={fluentStyles.remediationGrid}>
                        {renderObjectProperties("Validation Metrics", data, "target")}
                    </div>
                )}


            </div>
        );
    };

    return (
        <div className={styles.container} style={{ fontFamily: T.font }}>
            {/* ── HEADER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className={styles.header}>
                    <Text className={styles.title} style={{ fontSize: "32px", fontWeight: 600, display: "block" }}>Validation Results</Text>
                    <Text className={styles.subtitle}>
                        Verification and parity analysis for <span style={{ color: "#0f172a", fontWeight: 600 }}>{displayName}</span>
                    </Text>
                </div>

                {/* TEMPORARILY DISABLED - ENABLE LATER */}
                {ENABLE_RERUN_VALIDATION && (
                    <Button
                        onClick={handleRerunValidation}
                        disabled={isRevalidating}
                        style={{
                            borderRadius: "8px",
                            fontWeight: 600,
                            padding: "0 24px",
                            height: "48px",
                            backgroundColor: "var(--primary)",
                            boxShadow: "var(--shadow-sm)",
                            flexShrink: 0,
                            marginTop: "4px"
                        }}
                    >
                        <RefreshCw style={{ marginRight: 8 }} />
                        {isRevalidating ? "Triggering..." : "Re-run Validation"}
                    </Button>
                )}
            </div>

            {/* ── VALIDATION RESULTS CONTENT (REFRESH EFFECT) ── */}
            <div style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '12px'
            }}>
                {isRefreshingValidationResults && (
                    <div className="devops-loading-overlay">
                        <Spinner size="large" />
                        <span className="devops-loading-text">Synchronizing latest validation updates...</span>
                    </div>
                )}


            {/* 1. Top-Level Scorecard Grid - Always Visible */}
            <div className={styles.metricsGrid} style={{ marginBottom: "24px" }}>
                {(() => {
                    const prioritizedCategories = [
                        { label: "TABLES & COLUMNS", keys: ["Tables & Columns", "Tables", "Table", "tables"] },
                        { label: "CALCULATIONS", keys: ["Calculated Fields", "Calculations", "calculation_validation", "Calculated fields", "calculated_fields"] },
                        { label: "VISUALS", keys: ["Visuals", "visual_validation", "Visuals Validation"] }
                    ];

                    return prioritizedCategories.map((cat, cIdx) => {
                        const metricData = cat.keys.reduce((found, key) => found || metrics[key], null as any);
                        if (!metricData) return null;

                        // For Tables: count from validated_tables array for accurate totals
                        let matched: number;
                        let total: number;
                        if (cat.label === "TABLES & COLUMNS") {
                            const tablesData = getCategoryData("Tables & Columns") || getCategoryData("Tables");
                            const validatedTables = tablesData?.validated_tables || tablesData?.details || (Array.isArray(tablesData) ? tablesData : []);
                            total = validatedTables.length || (metricData.total ?? metricData.original_total ?? 0);
                            matched = validatedTables.filter((t: any) => {
                                const s = String(t.status || '').toUpperCase();
                                return s === 'PASS' || s === 'SUCCESS' || s === 'PASSED';
                            }).length || (metricData.matched ?? metricData.matched_count ?? 0);
                        } else if (cat.label === "CALCULATIONS") {
                            const calcSummary = migrationData?.calculation_summary || migrationComparison?.calculation_summary || migrationData?.calculated_fields?.summary || findCalculations(migrationData)?.summary;
                            total = calcSummary?.total_calculations ?? metricData.total ?? metricData.original_total ?? metricData.count ?? 0;
                            matched = total;
                        } else {
                            matched = metricData.matched ?? metricData.matched_count ?? metricData.migrated_total ?? metricData.passed ?? 0;
                            total = metricData.total ?? metricData.original_total ?? metricData.count ?? metricData.total_count ?? (metricData.details?.length) ?? 0;
                        }

                        return (
                            <div key={cIdx} className={styles.metricCard}>
                                <div className={styles.metricValue}>
                                    {matched}
                                    <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 400, marginLeft: "4px" }}>
                                        / {total}
                                    </span>
                                </div>
                                <div className={styles.metricLabel}>{cat.label}</div>
                            </div>
                        );
                    });
                })()}

                <div className={styles.metricCard} style={{ background: "var(--primary)", border: `1px solid var(--primary)` }}>
                    <div className={styles.metricValue} style={{ color: "var(--primary)" }}>
                        {overallAccuracy ? (String(overallAccuracy).includes('%') ? overallAccuracy : `${overallAccuracy}%`) : "0%"}
                    </div>
                    <div className={styles.metricLabel} style={{ color: "var(--primary)" }}>OVERALL ACCURACY</div>
                </div>
            </div>

            {/* 2. AI Summary Card (If Present) - Below Metrics */}
            {overallAiSummary && (
                <div
                    className={fluentStyles.aiSummaryCard}
                    style={{
                        marginBottom: "32px",
                        borderLeftColor: (overallAiSummary.conclusion === "PASS" || overallAiSummary.conclusion === "SUCCESS") ? "var(--success)" : "var(--warning)"
                    }}
                >
                    <div className={fluentStyles.aiSummaryHeader}>
                        <div className={fluentStyles.headerGroup}>
                            <div className={fluentStyles.iconBox}>
                                <BrainCircuit style={{ color: "var(--primary)" }} />
                            </div>
                            <div>
                                <Text weight="bold" size={500}>Summary</Text>
                                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                    <Badge variant={getStatusColor("", overallAiSummary.conclusion || "PASS")}>
                                        {(overallAiSummary.conclusion || "PASS").toUpperCase()}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {overallAccuracy ? (String(overallAccuracy).includes('%') ? overallAccuracy : `${overallAccuracy}%`) : "N/A"} Accuracy
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Text size={300} style={{ lineHeight: "1.7", color: "var(--text-secondary)", display: "block" }}>
                        {overallAiSummary.summary || overallAiSummary.summary_text || (typeof overallAiSummary === 'string' ? overallAiSummary : "Analysis complete.")}
                    </Text>
                </div>
            )}

            {/* 3. Tabbed Content - Below Summary */}
            <Card className={fluentStyles.tabsCard} style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
                <div className={fluentStyles.tabContent}>
                    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
                        <div className={styles.sectionHeader} style={{ marginTop: "8px" }}>
                            <div className={styles.sectionIndicator} />
                            <Text className={styles.sectionTitleText}>Asset Category Validation</Text>
                        </div>

                        <div className={styles.categoryList}>
                            {displayedCategories.map(([category, status]) => (
                                <Card
                                    key={category}
                                    className="vl-hover-card"
                                    style={{
                                        padding: "16px 20px",
                                        cursor: "pointer",
                                        border: `1px solid var(--border)`,
                                        background: "var(--surface)",
                                        borderRadius: "12px",
                                        transition: "all 0.2s ease",
                                        marginBottom: "12px"
                                    }}
                                    onClick={() => setSelectedCategory(category)}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                            <div style={{
                                                background: "var(--primary)",
                                                padding: "10px",
                                                borderRadius: "10px",
                                                display: "flex"
                                            }}>
                                                {getCategoryIcon(category)}
                                            </div>
                                            <div>
                                                <Text weight="bold" size={400} style={{ color: "var(--text)", display: "block" }}>{category}</Text>
                                                <Text size={200} style={{ color: "var(--text-muted)" }}>Detailed verification items</Text>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                                            <div style={{ textAlign: "right", marginRight: "12px" }}>
                                                <Text weight="bold" size={500} style={{
                                                    color: getStatusColor(category, String(status)) === "success" ? "var(--success)" :
                                                        getStatusColor(category, String(status)) === "warning" ? "var(--warning)" :
                                                            "var(--text)",
                                                    display: "block"
                                                }}>
                                                    {status}
                                                </Text>
                                                <Text size={100} weight="semibold" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>ACCURACY</Text>
                                            </div>
                                            <ChevronRight style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Sub-Category Detail Dialog */}
            {selectedCategory && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
                    backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)"
                }}>
                    <Card style={{
                        width: "90%", maxWidth: "1200px", maxHeight: "90vh",
                        display: "flex", flexDirection: "column", padding: 0,
                        backgroundColor: "var(--surface)",
                        borderRadius: "16px", boxShadow: "var(--shadow-md)"
                    }}>
                        <div style={{
                            padding: "20px 24px", borderBottom: `1px solid var(--border)`,
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "linear-gradient(to right, #f8fafc, #ffffff)"
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                <div style={{ background: "var(--primary)", padding: "8px", borderRadius: "8px" }}>
                                    {getCategoryIcon(selectedCategory)}
                                </div>
                                <div>
                                    <Text weight="bold" size={500}>{selectedCategory === "Tables & Columns" ? selectedCategory : (selectedCategory.endsWith("Validation") ? selectedCategory : `${selectedCategory} Validation`)}</Text>
                                    <Text size={200} style={{ color: "var(--text-muted)", display: "block" }}>Deep-dive comparison audit</Text>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => { setSelectedCategory(null); setDebugOpen(false); }}
                            ><X /></Button>
                        </div>
                        <div className={fluentStyles.scrollableContent} style={{ padding: "24px" }}>
                            {renderCategoryDetail(selectedCategory)}
                        </div>

                    </Card>
        </div>
            )}

            </div>
            {/* ── END VALIDATION RESULTS CONTENT (REFRESH EFFECT) ── */}

            {/* Validation Re-run Notification Dialog */}
            <Dialog open={revalidationSuccessOpen} onOpenChange={setRevalidationSuccessOpen}>
                <DialogContent style={{ maxWidth: "450px" }}>
                    <DialogHeader>
                        <DialogTitle>Validation Re-Run Triggered</DialogTitle>
                    </DialogHeader>
                    <div style={{ paddingTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <span>Validation Re-Run completed successfully.</span>
                        <span>The latest validation results are currently being refreshed and synchronized.</span>
                        <span>Please review the updated validation results to observe the latest changes, fixes, and validation updates.</span>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => {
                            setRevalidationSuccessOpen(false);
                            // Clear any previous timer to prevent animation stacking on repeated re-runs
                            if (refreshTimerRef.current) {
                                clearTimeout(refreshTimerRef.current);
                                refreshTimerRef.current = null;
                            }
                            setIsRefreshingValidationResults(true);
                            // Auto-stop after 1.5s (matches CSS overlay fade animation)
                            refreshTimerRef.current = setTimeout(() => {
                                setIsRefreshingValidationResults(false);
                                refreshTimerRef.current = null;
                            }, 1500);
                        }}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}




