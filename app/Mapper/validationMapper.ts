export interface ValidationCheck {
  name: string;
  status: "passed" | "failed" | "warning";
}

export interface ValidationMetrics {
  rowCountMatch: boolean;
  aggregateAccuracy: number;
  visualFidelityScore: number;
  passedChecks: number;
  totalChecks: number;
}

export interface RowCountFidelity {
  tableName: string;
  expectedRowCount: number;
}

export interface ValidationPayload {
  run_id?: string;
  workbook_name?: string;
  metrics: ValidationMetrics;
  checks: ValidationCheck[];
  issues: string[];
  extractionStatus?: string;
  extractionMessage?: string;
  rowCounts?: RowCountFidelity[];
  status?: string;
  migration_comparison?: any;
  remediation?: any[];
  datasource_validation?: any[];
  relationship_validation?: any[];
  tables?: any;
  dimensions?: any[];
  measures?: any[];
  calculation_validation?: any[];
  calculated_fields?: any;
  visuals?: any[];
  visual_validation?: any;
  visuals_validation?: any[];
  lod_validation?: any[];
  custom_sql_validation?: any[];
  measures_validation?: any[];
  technical_logs?: any;
  action_validation?: any[];
  fabric_validation?: any;
  projectId?: string;
  runId?: string;
}

export function mapValidationPayload(rawDoc: any): ValidationPayload {
  if (!rawDoc) return createEmptyValidationPayload();

  // If the Cosmos DB API returns an array of records, we need to unwrap it
  let document = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
  if (typeof document === 'string') {
    try { document = JSON.parse(document); } catch (e) { }
  }
  if (!document) return createEmptyValidationPayload();

  // Handle nested payload structure from different APIs
  let data = document.payload || document.validation_results || document.validation || document.data || document.result || document;

  if (Array.isArray(data)) {
    const semanticCandidate = data.find(item =>
      item?.relationship_validation ||
      item?.calculated_fields ||
      item?.payload?.relationship_validation ||
      item?.payload?.calculated_fields
    );
    data = semanticCandidate || data[0] || {};
    console.log("[ValidationMapper] Found semantic candidate in array:", !!semanticCandidate);
  }

  if (data?.payload) data = data.payload;

  if (data.json_report && typeof data.json_report === 'object') {
    data = { ...data, ...data.json_report };
  }

  if (data.payload && typeof data.payload === 'object') data = { ...data, ...data.payload };

  if (data.validation_summary && typeof data.validation_summary === 'object') {
    data = { ...data, ...data.validation_summary };
  }

  const findVal = (obj: any, keys: string[], defaultVal: any = 0) => {
    if (!obj) return defaultVal;
    for (const key of keys) {
      if (obj[key] !== undefined) return obj[key];
      const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (obj[snake] !== undefined) return obj[snake];
      const camel = key.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));
      if (obj[camel] !== undefined) return obj[camel];
    }
    return defaultVal;
  };

  // 1. Map Metrics
  const rawMetrics = data.metrics || data.migration_comparison?.metrics || data.validation_metrics || data.scores || data.summary || data.results || data;
  const passedAuthStatus = data.status === "PASS" || data.status === "completed" || data.status === "SUCCESS";

  const metrics: ValidationMetrics = {
    rowCountMatch: !!findVal(rawMetrics, ['rowCountMatch', 'row_count_match', 'rows_match', 'rowCount', 'row_count_validated'], passedAuthStatus),
    aggregateAccuracy: Number(findVal(rawMetrics, ['aggregateAccuracy', 'aggregate_accuracy', 'accuracy', 'acc', 'data_accuracy', 'overall_accuracy', 'accuracy_percentage'], passedAuthStatus ? 100 : 0)),
    visualFidelityScore: Number(findVal(rawMetrics, ['visualFidelityScore', 'visual_fidelity_score', 'fidelity', 'visual_fidelity', 'fidelity_score'], passedAuthStatus ? 100 : 0)),
    passedChecks: Number(findVal(rawMetrics, ['passedChecks', 'passed_checks', 'checks_passed', 'passed', 'pass_count'], passedAuthStatus ? 4 : 0)),
    totalChecks: Number(findVal(rawMetrics, ['totalChecks', 'total_checks', 'checks_total', 'total', 'check_count'], 4))
  };

  if (metrics.totalChecks === 0) metrics.totalChecks = 4;

  // 2. Map Extraction Row Counts
  const extraction = data.extraction || {};
  const extractedTargets = extraction.extracted_targets || {};
  const rawRowCounts = extractedTargets.Data_Accuracy_RowCounts || [];

  const mappedRowCounts: RowCountFidelity[] = Array.isArray(rawRowCounts) ? rawRowCounts.map((rc: any) => ({
    tableName: rc.table_name || "Unknown Table",
    expectedRowCount: Number(rc.expected_row_count) || 0
  })) : [];

  // 3. Map Checks Array safely
  let rawChecks = data.checks || data.validation_checks || data.checklist || data.validation_items || [];
  if (!Array.isArray(rawChecks) && typeof rawChecks === 'object') {
    rawChecks = Object.entries(rawChecks).map(([name, status]) => ({ name, status }));
  }

  const generatedChecks: ValidationCheck[] = [
    { name: "Data Accuracy Row Counts", status: mappedRowCounts.length > 0 ? "passed" : "failed" },
    { name: "Aggregate Data Validation", status: passedAuthStatus ? "passed" : "failed" },
    { name: "Payload Formatting", status: (data.extraction?.status === "PASS" || data.status === "completed") ? "passed" : "warning" },
    { name: "Visual Fidelity Validation", status: passedAuthStatus ? "passed" : "warning" }
  ];

  const checks: ValidationCheck[] = Array.isArray(rawChecks) && rawChecks.length > 0 ? rawChecks.map((c: any) => ({
    name: String(c.name || c.check_name || c.title || c.category || "Unknown Check"),
    status: normalizeStatus(c.status || c.result || c.state || c.outcome)
  })) : generatedChecks;

  // 4. Map Issues/Remediation Array safely
  const rawIssues = data.issues || data.errors || data.warnings || data.findings || data.recommendations || [];
  let issues: string[] = Array.isArray(rawIssues)
    ? rawIssues.map((i: any) => typeof i === "string" ? i : (i.message || i.description || i.text || JSON.stringify(i)))
    : [];

  const rawRemediation = data.remediation || document.remediation || [];
  if (Array.isArray(rawRemediation)) {
    rawRemediation.forEach((r: any) => {
      if (typeof r === 'string') {
        if (r.startsWith('{')) {
          try {
            const jsonStr = r.replace(/'/g, '"');
            const parsed = JSON.parse(jsonStr);
            issues.push(`${parsed.component || parsed.dashboard || parsed.type || 'General'}: ${parsed.recommendation || parsed.reason || parsed.suggestion}`);
          } catch (e) {
            issues.push(r);
          }
        } else {
          issues.push(r);
        }
      } else if (typeof r === 'object' && r !== null) {
        const component = r.component || r.dashboard || r.type || "General";
        const recommendation = r.recommendation || r.reason || r.suggestion || "Manual reconciliation suggested.";
        issues.push(`${component}: ${recommendation}`);
      }
    });
  }

  if (issues.length === 0 && !passedAuthStatus) {
    issues = ["Validation process highlighted potential discrepancies. Please check raw output."];
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Extract Migration Comparison — CLEAN structure, do NOT spread techLogs
  // ═══════════════════════════════════════════════════════════════════════
  const rawMigrationComparison = data.migration_comparison || {};
  const techLogs = data.technical_logs || document.technical_logs || {};

  // Build clean migration_comparison — keep technical_logs NESTED, not spread
  let migrationComparison: any = {
    ...rawMigrationComparison,
    technical_logs: techLogs,
  };

  // Ensure overall_ai_summary
  if (!migrationComparison.overall_ai_summary && data.overall_ai_summary) {
    migrationComparison.overall_ai_summary = data.overall_ai_summary;
  }
  if (!migrationComparison.overall_ai_summary && document.overall_ai_summary) {
    migrationComparison.overall_ai_summary = document.overall_ai_summary;
  }

  // Ensure accuracy_percentage
  if (!migrationComparison.accuracy_percentage) {
    migrationComparison.accuracy_percentage = data.accuracy_percentage || data.overall_accuracy || (data.summary?.overall_accuracy) || (data.metrics?.overall_accuracy);
  }

  const getCollection = (key: string) => data[key] || document[key] || (techLogs && techLogs[key]);

  // ── Map sub-validations from technical_logs ──

  // Relationship validation
  let relDoc = data.relationship_validation ||
    document.relationship_validation ||
    data.relationships ||
    document.relationships ||
    data.relationship_summary ||
    document.relationship_summary ||
    (techLogs && (techLogs.relationship_validation || techLogs.metadata_validation?.relationships));

  if (relDoc) {
    if (Array.isArray(relDoc)) {
      migrationComparison.relationship_validation = {
        summary: {
          total: relDoc.length,
          matched: relDoc.filter((i: any) => { const s = String(i.status || '').toUpperCase(); return s === 'PASS' || s === 'SUCCESS'; }).length,
          accuracy_percentage: (relDoc.length > 0) ? `${Math.round((relDoc.filter((i: any) => { const s = String(i.status || '').toUpperCase(); return s === 'PASS' || s === 'SUCCESS'; }).length / relDoc.length) * 100)}%` : "0%"
        },
        items: relDoc,
        details: relDoc
      };
    } else if (typeof relDoc === 'object') {
      const relSummary = relDoc.summary || relDoc.relationship_summary || relDoc.results_summary || {};
      const items = relDoc.items || relDoc.details || relDoc.relationship_items || [];
      const totalCount = relSummary.total || items.length || 0;
      const matchedItemsCount = items.filter((i: any) => {
        const s = String(i.status || '').toUpperCase();
        const aVal = i.accuracy_percentage ?? i.accuracy ?? i.comparison?.accuracy_percentage ?? i.accuracy_score;
        const a = parseFloat(String(aVal || '0'));
        return s === 'PASS' || s === 'SUCCESS' || a >= 100 || (a > 0.99 && a <= 1);
      }).length;
      const matchedCount = (relSummary.matched && relSummary.matched > 0) ? relSummary.matched : matchedItemsCount;

      migrationComparison.relationship_validation = {
        ...relDoc,
        isAntigravityMapped: true,
        summary: { ...relSummary, total: totalCount, matched: matchedCount, accuracy_percentage: relSummary.accuracy_percentage || relDoc.accuracy_percentage || (totalCount > 0 ? `${Math.round((matchedCount / totalCount) * 100)}%` : "0%") },
        items,
        details: items
      };
    }
  }

  // Tables from metadata_validation
  const tablesDoc = getCollection('tables') || techLogs?.metadata_validation?.tables;
  if (tablesDoc) migrationComparison.tables = tablesDoc;

  // Datasources from metadata_validation
  const dsDoc = getCollection('datasource_validation') || techLogs?.metadata_validation?.datasources;
  if (dsDoc) migrationComparison.datasource_validation = dsDoc;

  // Calculation validation from technical_logs
  const calcDoc = getCollection('calculation_validation') || techLogs?.calculation_validation;
  if (calcDoc) migrationComparison.calculation_validation = calcDoc;

  // LOD validation from technical_logs
  const lodDoc = getCollection('lod_validation') || techLogs?.lod_validation;
  if (lodDoc) migrationComparison.lod_validation = lodDoc;

  // Measures validation from technical_logs
  const measDoc = getCollection('measures_validation') || techLogs?.measures_validation;
  if (measDoc) migrationComparison.measures_validation = measDoc;

  // Action validation from technical_logs
  const actDoc = getCollection('action_validation') || techLogs?.action_validation;
  if (actDoc) migrationComparison.action_validation = actDoc;

  // Calculated fields (summary/breakdown pattern)
  const calcSummary = getCollection('calculation_summary') || getCollection('calculation_metadata');
  const calcBreakdown = getCollection('calculation_breakdown');

  if (calcSummary || calcBreakdown) {
    const calcObj: any = {
      summary: calcSummary || {},
      groups: {},
      details: [],
      status: calcSummary?.status || calcSummary?.overall_status || "UNKNOWN",
      accuracy_percentage: calcSummary?.accuracy_percentage || calcSummary?.overall_accuracy
    };

    if (calcBreakdown && typeof calcBreakdown === 'object' && !Array.isArray(calcBreakdown)) {
      // It's a grouped object: { "measures": { "items": [...] }, "dimensions": [...] }
      Object.entries(calcBreakdown).forEach(([key, value]: [string, any]) => {
        const items = Array.isArray(value) ? value : (Array.isArray(value?.items) ? value.items : []);
        calcObj.groups[key] = items;
        calcObj.details.push(...items);
      });
    } else if (Array.isArray(calcBreakdown)) {
      // It's a flat array
      calcObj.details = calcBreakdown;
      calcObj.groups = null; // Trigger manual grouping in view
    }

    migrationComparison.calculated_fields = calcObj;
  }
  if (!migrationComparison.calculated_fields) {
    const cf = getCollection('calculated_fields');
    if (cf) migrationComparison.calculated_fields = cf;
  }

  // Normalise overall_ai_summary to object if string
  if (typeof migrationComparison.overall_ai_summary === 'string') {
    const text = migrationComparison.overall_ai_summary;
    const accuracyMatch = text.match(/accuracy of (\d+%)/i) || text.match(/accuracy: (\d+%)/i);
    const accuracy_score = accuracyMatch ? accuracyMatch[1] : (migrationComparison.accuracy_percentage || data.accuracy_percentage || "0%");
    migrationComparison.overall_ai_summary = { conclusion: passedAuthStatus ? "PASS" : "PARTIAL", summary_text: text, accuracy_score };
  }

  // Data Validation normalization
  let fabric = data.fabric_validation || document.fabric_validation || null;
  if (fabric && typeof fabric === 'object' && !Array.isArray(fabric)) {
    // 1. Robust array discovery (prioritize 'row_count_comparison' from new structure)
    let nestedArray = fabric.row_count_comparison || fabric.fabric_validation || fabric.details || fabric.items;

    if (!Array.isArray(nestedArray)) {
      const firstArrayKey = Object.keys(fabric).find(k => Array.isArray(fabric[k]) && k !== 'checks' && k !== 'issues');
      if (firstArrayKey) nestedArray = fabric[firstArrayKey];
    }

    if (Array.isArray(nestedArray)) {
      // 2. Normalize items (ensure they have name/title/status)
      const mappedDetails = nestedArray.map((item: any) => ({
        ...item,
        name: item.name || item.table_name || item.rule || item.check || item.title || "Validation Rule",
        status: normalizeStatus(item.status || item.parity_status || item.result || (parseFloat(item.accuracy_percentage) >= 100 ? "PASS" : "FAIL")),
        reasoning: item.reasoning || item.parity_result || item.reason || ""
      }));

      fabric.details = mappedDetails;

      // 3. Auto-calculate summary if missing or incomplete
      const isSummaryEmpty = !fabric.summary || Object.keys(fabric.summary).length === 0;
      const s = fabric.summary || {};

      if (isSummaryEmpty || (!s.total && !s.total_fabric_tables)) {
        const total = s.total_fabric_tables || s.total_parsing_tables || mappedDetails.length;
        const matched = s.matched_in_fabric || s.matched || mappedDetails.filter((i: any) => {
          const st = String(i.status || '').toUpperCase();
          const aVal = i.accuracy_percentage ?? i.accuracy ?? i.comparison?.accuracy_percentage ?? i.accuracy_score;
          const a = parseFloat(String(aVal || '0'));
          return st === 'PASS' || st === 'SUCCESS' || a >= 100 || (a > 0.99 && a <= 1);
        }).length;

        fabric.summary = {
          ...s,
          total,
          matched,
          accuracy_percentage: fabric.overall_accuracy_percentage || s.parity_accuracy || (total > 0 ? `${Math.round((matched / total) * 100)}%` : "0%"),
          failed: s.failed ?? mappedDetails.filter((i: any) => {
            const st = String(i.status || '').toUpperCase();
            return st === 'FAIL' || st === 'FAILED' || st === 'ERROR';
          }).length,
          partial: s.partial ?? mappedDetails.filter((i: any) => {
            const st = String(i.status || '').toUpperCase();
            return st === 'PARTIAL' || st === 'WARNING';
          }).length
        };
      } else if (!fabric.summary.accuracy_percentage) {
        fabric.summary.accuracy_percentage = fabric.overall_accuracy_percentage || fabric.summary.parity_accuracy || "0%";
      }
    }
  }

  return {
    workbook_name: data.workbook_name || document.project_name || document.workbook_id || "Workbook",
    metrics,
    checks,
    issues,
    extractionStatus: extraction.status || data.extraction?.status || data.status || "UNKNOWN",
    extractionMessage: extraction.message || data.extraction?.message || "No extraction messages provided",
    rowCounts: mappedRowCounts,
    status: data.status || document.status || "UNKNOWN",
    migration_comparison: migrationComparison,
    remediation: rawRemediation,
    fabric_validation: fabric,
    datasource_validation: migrationComparison.datasource_validation || [],
    relationship_validation: migrationComparison.relationship_validation || [],
    tables: migrationComparison.tables || [],
    dimensions: getCollection('dimensions') || [],
    measures_validation: migrationComparison.measures_validation || [],
    calculation_validation: migrationComparison.calculation_validation || migrationComparison.calculated_fields || [],
    calculated_fields: migrationComparison.calculated_fields || migrationComparison.calculation_validation || [],
    visuals: (getCollection('visual_validation')?.details || getCollection('visual_validation') || getCollection('visuals')?.details || getCollection('visuals') || []),
    visual_validation: getCollection('visual_validation') || getCollection('visuals') || null,
    visuals_validation: (getCollection('visual_validation')?.details || getCollection('visual_validation') || getCollection('visuals')?.details || getCollection('visuals') || []),
    lod_validation: migrationComparison.lod_validation || [],
    custom_sql_validation: getCollection('custom_sql_validation') || getCollection('custom_sql') || [],
    action_validation: migrationComparison.action_validation || [],
    technical_logs: techLogs || {},
    projectId: document.project_id || document.projectId || data.project_id || "",
    runId: document.run_id || document.runId || data.run_id || ""
  };
}

function normalizeStatus(rawStatus: any): "passed" | "failed" | "warning" {
  if (!rawStatus) return "failed";
  const s = String(rawStatus).toLowerCase();
  if (s === "passed" || s === "pass" || s === "success" || s === "ok" || s === "true" || s === "pass") return "passed";
  if (s === "warning" || s === "warn" || s === "partial") return "warning";
  return "failed";
}

function createEmptyValidationPayload(): ValidationPayload {
  return {
    metrics: { rowCountMatch: false, aggregateAccuracy: 0, visualFidelityScore: 0, passedChecks: 0, totalChecks: 4 },
    checks: [
      { name: "Data Accuracy Row Counts", status: "failed" },
      { name: "Aggregate Data Validation", status: "failed" },
    ],
    issues: ["No validation data provided or failed to load."],
    rowCounts: []
  };
}
