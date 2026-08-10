// lib/pdf/extractAssessmentMetrics.ts
import { MigrationReportData } from "./migrationReportGenerator"

export interface RiskFactor {
  name: string
  count: number
}

export interface WorkbookAsset {
  name: string
  complexity: number
  business: number
  type: "Workbook" | "Datasource"
}

export function extractAssessmentMetrics(
  currentRunId: string | null,
  currentWorkbookIds: string[],
  assessmentData: Record<string, Record<string, any>>,
  parsingData: Record<string, any>,
  projectName: string
): MigrationReportData {
  
  let _workbooksCount = 0
  let _dataSources = 0
  let _estEffort = 0
  let _totalComplexity = 0
  let _scoredWorkbooks = 0

  const complexityDist = {
    Low: 0,
    Medium: 0,
    High: 0,
  }

  const assetCounts = {
    workbooks: 0,
    datasources: 0,
    tables: 0,
    worksheets: 0,
    dashboards: 0,
    calculations: 0,
  }

  const vizTypeFreq: Record<string, number> = {}
  const connectionModes = { live: 0, extract: 0 }
  const riskFreq: Record<string, number> = {}
  const ownerFreq: Record<string, number> = {}

  const projectMetrics = {
    workbooks: 0,
    datasources: 0,
    tables: 0,
    measures: 0,
    dimensions: 0,
    lods: 0,
  }

  const runData = currentRunId ? assessmentData[currentRunId] : {}

  // Calculate project metrics
  currentWorkbookIds.forEach(id => {
    const payload = runData?.[id]?.payload || {}

    // Data source counts
    projectMetrics.datasources += (payload.logical_datasources?.length || 0)

    // Table counts
    const pData = parsingData[id]
    if (pData?.tables && Array.isArray(pData.tables)) {
      projectMetrics.tables += pData.tables.length
    } else {
      const assessmentTables = (payload.tables_analysis?.total_tables || payload.tables_analysis?.total_count || 0)
      if (assessmentTables > 0) {
        projectMetrics.tables += assessmentTables
      } else if (payload.logical_datasources) {
        payload.logical_datasources.forEach((ds: any) => {
          projectMetrics.tables += (ds.tables?.length || ds.tableCount || 0)
        })
      }
    }

    // LOD counts
    const parsingLods = pData?.calculations?.filter((c: any) => c.is_lod).length || 0
    const assessmentLods = payload.lods_analysis?.total_count || 0
    projectMetrics.lods += Math.max(parsingLods, assessmentLods)

    // Measures and Dimensions
    const parsingMeasures = pData?.fields?.measures?.length || 0
    const parsingDimensions = pData?.fields?.dimensions?.length || 0

    if (parsingMeasures > 0 || parsingDimensions > 0) {
      projectMetrics.measures += parsingMeasures
      projectMetrics.dimensions += parsingDimensions
    } else if (payload.calculation_stats) {
      const stats = payload.calculation_stats
      const total = stats.total_calculations || 0
      const measures = stats.num_measures ?? Math.round((stats.pct_basic / 100) * total)
      const dimensions = stats.num_dimensions ?? (total - measures)

      projectMetrics.measures += Math.max(0, measures)
      projectMetrics.dimensions += Math.max(0, dimensions)
    }
  })

  projectMetrics.workbooks = currentWorkbookIds.length

  // Calculate assessment metrics
  currentWorkbookIds.forEach(wbId => {
    const data = runData?.[wbId]?.payload
    if (!data) return
    const pData = parsingData[wbId]

    _workbooksCount++
    _dataSources += (data.logical_datasources?.length || 0)
    assetCounts.workbooks += 1
    assetCounts.datasources += data.logical_datasources?.length || pData?.sources?.length || 0
    assetCounts.tables += pData?.tables?.length || 0
    assetCounts.worksheets += pData?.worksheets?.length || data.visuals?.sheet_count || 0
    assetCounts.dashboards += pData?.dashboards_list?.length || data.dashboards_detailed?.count || 0
    assetCounts.calculations += pData?.calculations?.length || data.calculation_stats?.total_calculations || 0

    const owner = (data.owner_name || "Unknown Owner").replace(/^ID:\s*/i, "")
    ownerFreq[owner] = (ownerFreq[owner] || 0) + 1

    const compScore = data.complexity?.complexity_score
    const estMin = data.complexity?.estimated_migration_minutes || 0

    _estEffort += estMin
    if (typeof compScore === 'number') {
      _totalComplexity += compScore
      _scoredWorkbooks++

      if (compScore < 40) {
        complexityDist.Low++
      } else if (compScore < 75) {
        complexityDist.Medium++
      } else {
        complexityDist.High++
      }
    } else {
      complexityDist.Medium++
    }

    // Extract risk factors
    const workbookRisks = new Set<string>()

    const hasCube = (data.logical_datasources || []).some((ds: any) => 
      ds.class?.toLowerCase().includes("cube") || 
      ds.type?.toLowerCase().includes("cube") ||
      ds.caption?.toLowerCase().includes("cube")
    )
    if (hasCube) workbookRisks.add("Cube data sources")

    if ((data.lods_analysis?.total_count || 0) > 0 || (data.calculation_stats?.pct_lod || 0) > 0) {
      workbookRisks.add("Complex LOD expressions")
    }

    if (data.security_entitlements?.has_rls) {
      workbookRisks.add("Row-level security")
    }

    if (data.version_info?.version) {
      const vNum = parseFloat(data.version_info.version)
      if ((!isNaN(vNum) && vNum < 2018.1) || data.legacy_risks?.has_legacy || String(data.version_info.version).startsWith("10.")) {
         workbookRisks.add("Legacy Tableau version")
      }
    }

    if ((data.extract_analysis?.hyper_count || 0) > 1) {
      workbookRisks.add("Multiple extract dependencies")
    }

    if (data.semantics?.has_custom_sql || (data.custom_sql_details?.length || 0) > 0) {
      workbookRisks.add("Custom SQL Queries")
    }
    
    if ((data.calculation_stats?.pct_scripts || 0) > 0) {
      workbookRisks.add("Python/R Scripts dependencies")
    }

    workbookRisks.forEach((r: string) => {
      riskFreq[r] = (riskFreq[r] || 0) + 1
    })

    // Collect visualization types
    if (pData?.worksheets) {
      pData.worksheets.forEach((ws: any) => {
        const vType = ws.mark_type || ws.visual_type || "Other"
        const normalized = String(vType).toLowerCase().replace(/\s+/g, " ")
        vizTypeFreq[normalized] = (vizTypeFreq[normalized] || 0) + 1
      })
    }

    // Collect connection modes
    ;(data.logical_datasources || []).forEach((ds: any) => {
      const mode = ds.mode?.toLowerCase() === "live" || ds.connection_type?.toLowerCase().includes("live") ? "live" : "extract"
      if (mode === "live") connectionModes.live += 1
      else connectionModes.extract += 1
    })
  })

  // Extract top risks
  const topRisks = Object.entries(riskFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
    .slice(0, 8)

  // Extract top owners
  const topOwners = Object.entries(ownerFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
    .slice(0, 5)

  // Build matrixPoints for the prioritization scatter plot
  const matrixPoints: Array<{ id: string; name: string; type: 'Workbook' | 'Datasource'; complexity: number; business: number }> = []
  let wbIdx = 0
  currentWorkbookIds.forEach(wbId => {
    const data = runData?.[wbId]?.payload
    const pData = parsingData[wbId]
    if (!data) return
    wbIdx++

    const compScore = data.complexity?.complexity_score
    const worksheetCount = pData?.worksheets?.length || data.visuals?.sheet_count || 0
    const calcCount = pData?.calculations?.length || data.calculation_stats?.total_calculations || 0
    const dsCount = data.logical_datasources?.length || pData?.sources?.length || 0
    const actionCount = data.actions?.length || 0

    const business = Math.min(100, Math.max(10,
      Math.min(35, worksheetCount * 2.8) +
      Math.min(30, calcCount * 1.6) +
      Math.min(20, dsCount * 5) +
      Math.min(15, actionCount * 5)
    ))

    matrixPoints.push({
      id: `wb-${wbId}`,
      name: data.workbook_name || `Workbook ${wbIdx}`,
      type: 'Workbook',
      complexity: typeof compScore === 'number' ? Math.max(1, Math.min(100, compScore)) : 50,
      business,
    });

    (data.logical_datasources || []).forEach((ds: any, idx: number) => {
      const dsComplexity = Math.min(100, Math.max(8, (typeof compScore === 'number' ? compScore * 0.7 : 45) + (ds.has_extract ? 8 : 0)))
      const dsBusiness = Math.min(95, Math.max(10, 35 + (ds.has_extract ? 10 : 0) + (ds.is_published_datasource ? 12 : 0) + idx * 3))
      matrixPoints.push({
        id: `ds-${wbId}-${idx}`,
        name: ds.name || `Datasource ${idx + 1}`,
        type: 'Datasource',
        complexity: dsComplexity,
        business: dsBusiness,
      })
    })
  })

  return {
    projectName,
    currentRunId,
    workbookIds: currentWorkbookIds,
    projectMetrics,
    assessmentData,
    parsingData,
    assessmentMetrics: {
      workbooksCount: Math.max(_workbooksCount, currentWorkbookIds.length),
      dataSources: _dataSources,
      estEffort: _estEffort,
      totalComplexity: _totalComplexity,
      scoredWorkbooks: _scoredWorkbooks,
      complexityDist,
      assetCounts,
      vizTypeFreq,
      connectionModes,
      matrixPoints,
      riskFactors: topRisks,
      topOwners,
    }
  }
}
