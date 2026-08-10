// lib/pdf/migrationReportGenerator.ts
// HTML-based report generator — renders a full-fidelity report in a print window
// so the user can Save as PDF from the browser for industry-standard quality.

import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export interface MigrationReportData {
  projectName: string
  currentRunId?: string | null
  workbookIds: string[]
  projectMetrics: {
    workbooks: number
    datasources: number
    tables: number
    measures: number
    dimensions: number
    lods: number
  }
  assessmentData: Record<string, any>
  parsingData: Record<string, any>
  assessmentMetrics?: {
    workbooksCount: number
    dataSources: number
    estEffort: number
    totalComplexity: number
    scoredWorkbooks: number
    complexityDist: Record<string, number>
    assetCounts: Record<string, number>
    vizTypeFreq: Record<string, number>
    connectionModes: Record<string, number>
    matrixPoints: Array<any>
    riskFactors: Array<{ name: string; count: number }>
    topOwners?: Array<{ name: string; count: number }>
  }
}

// ─── colour palette matching UI ────────────────────────────────
const COLORS = {
  primary: '#0078D4',
  primaryLight: '#EFF6FC',
  green: '#107C10',
  greenLight: '#DFF6DD',
  orange: '#FFB900',
  orangeLight: '#FFF4CE',
  red: '#A4262C',
  redLight: '#FDE7E9',
  purple: '#5C2D91',
  teal: '#008272',
  gray: '#605E5C',
  lightGray: '#F3F2F1',
  borderGray: '#E1DFDD',
  text: '#323130',
  subText: '#605E5C',
}

const VIZ_COLORS = [
  '#0078D4', '#107C10', '#C239B3', '#FF8C00', '#2B88D8',
  '#498205', '#8764B8', '#038387', '#881798', '#E81123',
]

// ─── helpers ───────────────────────────────────────────────────
function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function pct(val: number, total: number): number {
  return total > 0 ? Math.round((val / total) * 100) : 0
}

function badge(label: string, color: string, bg: string): string {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;color:${color};background:${bg};border:1px solid ${color}33;">${esc(label)}</span>`
}

function sectionHeader(title: string, subtitle?: string): string {
  return `
  <div class="section-header">
    <div class="section-title">${esc(title)}</div>
    ${subtitle ? `<div class="section-subtitle">${esc(subtitle)}</div>` : ''}
  </div>`
}

function metricCard(label: string, value: string | number, sub?: string): string {
  // If value is explicitly null/undefined or empty string, skip
  if (value === null || value === undefined || value === '') return ''
  return `
  <div class="metric-card">
    <div class="metric-label">${esc(label)}</div>
    <div class="metric-value">${esc(String(value))}</div>
    ${sub ? `<div class="metric-sub">${esc(sub)}</div>` : ''}
  </div>`
}

function infoItem(label: string, value: string): string {
  if (!value || value === '—' || value === 'Unknown' || value === 'null') return ''
  return `<div class="info-item"><div class="info-label">${esc(label)}</div><div class="info-value">${value}</div></div>`
}

function conditionalTabSection(label: string, content: string): string {
  const trimmed = content?.trim() || ''
  if (!trimmed || trimmed === '<div class="empty-msg">No modeling data available.</div>' || trimmed === '<div class="empty-msg">No visual data available.</div>') {
    return ''
  }
  return `
  <div class="tab-section">
    <div class="tab-label">${esc(label)}</div>
    ${content}
  </div>`
}

function horizontalBar(label: string, val: number, max: number, color: string, showVal = true): string {
  const w = max > 0 ? Math.round((val / max) * 100) : 0
  return `
  <div class="bar-row">
    <span class="bar-label">${esc(label)}</span>
    <div class="bar-track">
      <div class="bar-fill" style="width:${w}%;background:${color};"></div>
    </div>
    ${showVal ? `<span class="bar-val">${val}</span>` : ''}
  </div>`
}

// ─── SVG prioritization matrix ─────────────────────────────────
function prioritizationMatrixSVG(matrixPoints: any[]): string {
  const SIZE = 320
  const PAD = 36
  const inner = SIZE - PAD * 2

  const dots = matrixPoints.map(pt => {
    const cx = PAD + (pt.complexity / 100) * inner
    const cy = PAD + ((100 - pt.business) / 100) * inner
    const color = pt.type === 'Workbook' ? COLORS.primary : COLORS.green
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${color}" fill-opacity="0.85">
      <title>${esc(pt.name)} — Complexity:${Math.round(pt.complexity)} Business:${Math.round(pt.business)}</title>
    </circle>`
  }).join('\n')

  const midX = PAD + inner / 2
  const midY = PAD + inner / 2

  return `
  <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" style="border:1px solid ${COLORS.borderGray};border-radius:8px;background:#fafafa;" role="img" aria-label="Prioritization Matrix">
    <!-- grid lines -->
    <line x1="${midX}" y1="${PAD}" x2="${midX}" y2="${PAD + inner}" stroke="#d1d5db" stroke-dasharray="4 3" stroke-width="1"/>
    <line x1="${PAD}" y1="${midY}" x2="${PAD + inner}" y2="${midY}" stroke="#d1d5db" stroke-dasharray="4 3" stroke-width="1"/>
    <!-- axes -->
    <line x1="${PAD}" y1="${PAD + inner}" x2="${PAD + inner}" y2="${PAD + inner}" stroke="#9CA3AF" stroke-width="1.5"/>
    <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${PAD + inner}" stroke="#9CA3AF" stroke-width="1.5"/>
    <!-- quadrant labels -->
    <text x="${PAD + 6}" y="${PAD + 14}" font-size="9" fill="#6B7280" font-weight="600">Quick Wins</text>
    <text x="${midX + 6}" y="${PAD + 14}" font-size="9" fill="#6B7280" font-weight="600">Flagships</text>
    <text x="${PAD + 6}" y="${PAD + inner - 8}" font-size="9" fill="#6B7280" font-weight="600">Clean Up</text>
    <text x="${midX + 6}" y="${PAD + inner - 8}" font-size="9" fill="#6B7280" font-weight="600">Defer</text>
    <!-- axis labels -->
    <text x="${PAD + inner / 2}" y="${SIZE - 4}" font-size="9" fill="#9CA3AF" text-anchor="middle">Complexity →</text>
    <text x="11" y="${PAD + inner / 2}" font-size="9" fill="#9CA3AF" text-anchor="middle" transform="rotate(-90,11,${PAD + inner / 2})">Business Value →</text>
    ${dots}
  </svg>`
}

// ─── per-workbook assessment HTML ──────────────────────────────
function workbookAssessmentHTML(wbId: string, assessmentData: Record<string, any>, parsingData: Record<string, any>, currentRunId: string | null): string {
  const entry = currentRunId ? assessmentData[currentRunId]?.[wbId] : null
  const payload = entry?.payload || {}
  const pData = parsingData[wbId] || {}

  const wbName = esc(payload.workbook_name || entry?.workbook_name || wbId)
  const compScore = payload.complexity?.complexity_score ?? '—'
  const compLabel = typeof compScore === 'number'
    ? (compScore < 40 ? 'Low' : compScore < 75 ? 'Medium' : 'High')
    : 'Unknown'
  const compColor = compLabel === 'Low' ? COLORS.green : compLabel === 'Medium' ? COLORS.orange : COLORS.red
  const compBg = compLabel === 'Low' ? COLORS.greenLight : compLabel === 'Medium' ? COLORS.orangeLight : COLORS.redLight

  const dsCount = payload.logical_datasources?.length ?? 0
  const dashCount = payload.dashboards_detailed?.count ?? pData.dashboards_list?.length ?? 0
  const sheetCount = pData.worksheets?.length ?? payload.visuals?.sheet_count ?? 0

  // ─── Overview section ───────────────────────────────────────
  const overviewHTML = `
  <div class="subsection">
    <div class="subsection-title">Workbook Information</div>
    <div class="info-grid">
      ${infoItem('Name', wbName)}
      ${infoItem('Connection Type', esc(entry?.connection_type || payload.connection_type || '—'))}
      ${infoItem('Version', esc(payload.version_info?.version || '—'))}
      ${infoItem('Owner', esc((payload.owner_name || '—').replace(/^ID:\s*/i, '')))}
      ${infoItem('Site', esc(payload.site_name || '—'))}
      ${infoItem('Project', esc(payload.project_name || '—'))}
    </div>
  </div>
  <div class="subsection">
    <div class="subsection-title">Content Summary</div>
    <div class="metric-row-4">
      ${metricCard('Data Sources', dsCount)}
      ${metricCard('Dashboards', dashCount)}
      ${metricCard('Sheets', sheetCount)}
      ${metricCard('Complexity', typeof compScore === 'number' ? `${compScore}/100` : '—', compLabel)}
    </div>
  </div>`

  // ─── Formatting & Styling ───────────────────────────────────
  const formatting = payload.formatting || {}
  const fmtSummary = formatting.summary || {}
  const uniqueColors: string[] = Array.isArray(fmtSummary.unique_custom_colors) ? fmtSummary.unique_custom_colors : []
  const uniqueFonts: string[] = Array.isArray(fmtSummary.unique_custom_fonts) ? fmtSummary.unique_custom_fonts : []
  const borderStyles: string[] = Array.isArray(fmtSummary.unique_border_styles) ? fmtSummary.unique_border_styles : []

  const colorSwatches = uniqueColors.length > 0 ? `
    <div class="subsection">
      <div class="subsection-title">Global Color Palette</div>
      <div class="color-swatches">
        ${uniqueColors.map(c => {
    const display = c.startsWith('#') ? c : `#${c}`
    return `<div class="swatch" style="background:${display};" title="${display}"><span class="swatch-label">${display.replace('#', '').substring(0, 6)}</span></div>`
  }).join('')}
      </div>
    </div>` : ''

  const formattingHTML = `
  <div class="subsection">
    <div class="subsection-title">Formatting Summary</div>
    <div class="metric-row-4">
      ${metricCard('Custom Fonts', uniqueFonts.length > 0 ? `Yes (${uniqueFonts.length})` : 'None')}
      ${metricCard('Custom Colors', uniqueColors.length > 0 ? `Yes (${uniqueColors.length})` : 'None')}
      ${metricCard('Custom Borders', borderStyles.length > 0 ? `Yes (${borderStyles.length})` : 'None')}
      ${metricCard('Border Styles', borderStyles.join(', ') || '—')}
    </div>
  </div>
  ${colorSwatches}
  ${uniqueFonts.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Custom Fonts</div>
    <div class="tag-list">${uniqueFonts.map(f => `<span class="tag">${esc(f)}</span>`).join('')}</div>
  </div>` : ''}`

  // ─── Data Sources ──────────────────────────────────────────
  const logicalDatasources: any[] = payload.logical_datasources || []
  const dsRows = logicalDatasources.map(ds => `
    <tr>
      <td>${esc(ds.name || ds.caption || '—')}</td>
      <td>${esc(ds.db_class || ds.class || '—')}</td>
      <td>${esc(ds.db_server || ds.server || '—')}</td>
      <td>${esc(ds.mode || (ds.has_extract ? 'Extract' : 'Live'))}</td>
      <td>${esc(ds.tables?.length ?? 0)}</td>
    </tr>`).join('')

  const dataSourcesHTML = logicalDatasources.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Data Source Details</div>
    <table class="report-table">
      <thead><tr><th>Name</th><th>Type/Class</th><th>Server</th><th>Mode</th><th>Tables</th></tr></thead>
      <tbody>${dsRows}</tbody>
    </table>
  </div>` : ''

  // ─── Modeling / Logical Layer ───────────────────────────────
  const logicalModel: any[] = pData.model?.logical || []
  const tables: any[] = pData.tables || []

  const relRows = logicalModel.map(rel => `
    <tr>
      <td><span class="pill">${esc(rel.left)}</span></td>
      <td style="text-align:center;">→</td>
      <td><span class="pill">${esc(rel.right)}</span></td>
      <td>${esc(rel.cardinality || '—')}</td>
      <td style="font-family:monospace;font-size:11px;">${esc(rel.expression || '—')}</td>
    </tr>`).join('')

  const tableRows = tables.map(t => `
    <tr>
      <td>${esc(t.name || t.table_name || '—')}</td>
      <td>${esc(t.schema || t.db_schema || '—')}</td>
      <td>${esc(t.connection || '—')}</td>
      <td>${esc(t.columns?.length ?? '—')}</td>
    </tr>`).join('')

  const modelingHTML = `
  ${logicalModel.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Logical Layer – Relationships</div>
    <table class="report-table">
      <thead><tr><th>From Table</th><th></th><th>To Table</th><th>Cardinality</th><th>Expression</th></tr></thead>
      <tbody>${relRows}</tbody>
    </table>
  </div>` : ''}
  ${tables.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Physical Tables</div>
    <table class="report-table">
      <thead><tr><th>Table Name</th><th>Schema</th><th>Connection</th><th>Columns</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>` : ''}`

  // ─── Calculations ────────────────────────────────────────────
  const calcs: any[] = pData.calculations || []
  const measures: any[] = pData.fields?.measures || []
  const dimensions: any[] = pData.fields?.dimensions || []
  const lods = calcs.filter(c => c.is_lod)

  const calcSample = calcs.map(c => `
    <tr>
      <td>${esc(c.name || '—')}</td>
      <td>${c.is_lod ? badge('LOD', COLORS.primary, COLORS.primaryLight) : esc(c.type || 'Calc')}</td>
      <td style="font-family:monospace;font-size:10px;max-width:240px;overflow:hidden;text-overflow:ellipsis;">${esc((c.formula || '').substring(0, 120))}</td>
    </tr>`).join('')

  const analyticalHTML = `
  <div class="subsection">
    <div class="subsection-title">Analytical Model Summary</div>
    <div class="metric-row-4">
      ${metricCard('Measures', measures.length || payload.calculation_stats?.num_measures || 0)}
      ${metricCard('Dimensions', dimensions.length || payload.calculation_stats?.num_dimensions || 0)}
      ${metricCard('Total Calculations', calcs.length || payload.calculation_stats?.total_calculations || 0)}
      ${metricCard('LOD Expressions', lods.length || payload.lods_analysis?.total_count || 0)}
    </div>
  </div>
  ${calcs.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Calculations (${calcs.length})</div>
    <table class="report-table">
      <thead><tr><th>Name</th><th>Type</th><th>Formula</th></tr></thead>
      <tbody>${calcSample}</tbody>
    </table>
  </div>` : ''}`

  // ─── Visuals & Actions ─────────────────────────────────────
  const worksheets: any[] = pData.worksheets || []
  const dashboards: any[] = pData.dashboards_list || []
  const actions: any[] = pData.action_list || payload.actions || []

  const wsRows = worksheets.map(ws => `
    <tr>
      <td>${esc(ws.name || '—')}</td>
      <td>${esc(ws.mark_type || ws.visual_type || '—')}</td>
      <td>${esc(ws.data_source || '—')}</td>
      <td>${esc(ws.rows_field || '—')}</td>
      <td>${esc(ws.cols_field || '—')}</td>
    </tr>`).join('')

  const dbRows = dashboards.map(db => `
    <tr>
      <td>${esc(db.name || '—')}</td>
      <td>${esc(db.layout || '—')}</td>
      <td>${esc(db.sheets?.length ?? '—')}</td>
    </tr>`).join('')

  const visualsHTML = `
  ${worksheets.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Worksheets (${worksheets.length})</div>
    <table class="report-table">
      <thead><tr><th>Name</th><th>Mark Type</th><th>Data Source</th><th>Rows</th><th>Columns</th></tr></thead>
      <tbody>${wsRows}</tbody>
    </table>
    
  </div>` : ''}
  ${dashboards.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Dashboards (${dashboards.length})</div>
    <table class="report-table">
      <thead><tr><th>Name</th><th>Layout</th><th>Sheets</th></tr></thead>
      <tbody>${dbRows}</tbody>
    </table>
  </div>` : ''}
  ${actions.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Actions (${actions.length})</div>
    <div class="tag-list">${actions.map((a: any) => `<span class="tag">${esc(a.name || a.type || a)}</span>`).join('')}</div>
  </div>` : ''}`

  // ─── Security & Risks ──────────────────────────────────────
  const hasRLS = payload.security_entitlements?.has_rls
  const reasoning: string[] = payload.complexity?.reasoning || []
  const customSqlDetails: any[] = payload.custom_sql_details || []
  const hasCubeDs = (logicalDatasources).some((ds: any) => ds.class?.toLowerCase().includes('cube'))

  const securityHTML = `
  <div class="subsection">
    <div class="subsection-title">Security</div>
    <div class="info-grid">
      ${infoItem('Row-Level Security', hasRLS ? badge('Yes – RLS Detected', COLORS.red, COLORS.redLight) : badge('No', COLORS.green, COLORS.greenLight))}
      ${infoItem('Cube Data Sources', hasCubeDs ? badge('Yes', COLORS.orange, COLORS.orangeLight) : badge('No', COLORS.green, COLORS.greenLight))}
      ${infoItem('Custom SQL', customSqlDetails.length > 0 ? badge(`Yes (${customSqlDetails.length})`, COLORS.orange, COLORS.orangeLight) : badge('No', COLORS.green, COLORS.greenLight))}
    </div>
  </div>
  ${reasoning.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Complexity Reasoning / Risk Flags</div>
    <ul class="risk-list">
      ${reasoning.map((r: string) => `<li>${esc(r)}</li>`).join('')}
    </ul>
  </div>` : ''}
  ${customSqlDetails.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Custom SQL Queries (${customSqlDetails.length})</div>
    ${customSqlDetails.map((sql: any) => `
    <div class="code-block">
      <div class="code-title">${esc(sql.name || sql.datasource || 'Custom SQL')}</div>
      <pre>${esc((sql.query || sql.sql || '').substring(0, 400))}</pre>
    </div>`).join('')}
  </div>` : ''}`

  // ─── Challenges ──────────────────────────────────────────────
  const challenges: any[] = payload.challenges || payload.migration_challenges || []
  const challengesHTML = challenges.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Migration Challenges (${challenges.length})</div>
    <ul class="risk-list">
      ${challenges.map((c: any) => `<li><strong>${esc(c.title || c.type || c.challenge || '⚠')}:</strong> ${esc(c.description || c.detail || c.risk_mitigation || (typeof c === 'string' ? c : JSON.stringify(c)))}</li>`).join('')}
    </ul>
  </div>` : ''

  return `
  <div class="workbook-section">
    <div class="workbook-header">
      <div class="workbook-name">${wbName}</div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${badge(compLabel + ' Complexity', compColor, compBg)}
        ${typeof compScore === 'number' ? `<span style="font-size:20px;font-weight:700;color:${compColor};">${compScore}<span style="font-size:12px;color:${COLORS.subText};">/100</span></span>` : ''}
      </div>
    </div>

    ${conditionalTabSection('Overview', overviewHTML)}
    ${conditionalTabSection('Formatting & Styling', formattingHTML)}
    ${conditionalTabSection('Data Sources', dataSourcesHTML)}
    ${conditionalTabSection('Modeling', modelingHTML)}
    ${conditionalTabSection('Analytical Model & Calculations', analyticalHTML)}
    ${conditionalTabSection('Visuals & Actions', visualsHTML)}
    ${conditionalTabSection('Security & Risks', securityHTML)}
    ${challengesHTML ? conditionalTabSection('Challenges', challengesHTML) : ''}
  </div>`
}

// infoItem is now defined above to support conditional rendering

// ─── per-workbook PARSING results HTML ─────────────────────────
function workbookParsingHTML(wbId: string, parsingData: Record<string, any>): string {
  const d = parsingData[wbId]
  if (!d) {
    return `
  <div class="workbook-section">
    <div class="workbook-header" style="background:${COLORS.teal};">
      <div class="workbook-name">${esc(wbId)}</div>
      <span style="font-size:12px;opacity:.85;">Parsing Status</span>
    </div>
    <div class="tab-section">
      <div class="tab-label">Summary</div>
      <div class="empty-msg">Parsing is in progress or not available yet for this workbook.</div>
    </div>
  </div>`
  }

  const wbName = esc(d.workbook_name || wbId)

  // ── Summary metrics row ─────────────────────────────────────
  const lods = (d.calculations || []).filter((c: any) => c.is_lod).length || d.lod_total || 0
  const summaryHTML = `
  <div class="subsection">
    <div class="metric-row-4">
      ${metricCard('Live Connections', d.live ?? 0)}
      ${metricCard('Extract Connections', d.extract ?? 0)}
      ${metricCard('Sheets', d.sheets ?? (d.worksheets?.length ?? 0))}
      ${metricCard('Dashboards', d.dashboards ?? (d.dashboards_list?.length ?? 0))}
    </div>
    <div class="metric-row-4" style="margin-top:0;">
      ${metricCard('Dimensions', d.dimensions ?? d.fields?.dimensions?.length ?? 0)}
      ${metricCard('Measures', d.measures ?? d.fields?.measures?.length ?? 0)}
      ${metricCard('Calculated Fields', d.calculated ?? (d.calculations?.length ?? 0))}
      ${metricCard('LOD Expressions', lods, `Fixed:${d.lod_fixed ?? 0} Inc:${d.lod_include ?? 0} Exc:${d.lod_exclude ?? 0}`)}
    </div>
    <div class="metric-row-4" style="margin-top:0;">
      ${metricCard('Actions', d.actions ?? 0)}
      ${metricCard('Stories', d.stories ?? (d.stories_list?.length ?? 0))}
      ${metricCard('Parameters', d.parameters?.length ?? 0)}
      ${metricCard('Sets', d.sets?.length ?? 0)}
    </div>
  </div>`

  // ── Workbook info ───────────────────────────────────────────
  const wbInfoHTML = (d.version || d.file_type || d.owner || d.site || d.last_modified || d.source_build || (d.tags?.length > 0)) ? `
  <div class="subsection">
    <div class="subsection-title">Workbook Info</div>
    <div class="info-grid">
      ${d.version ? infoItem('Version', esc(d.version)) : ''}
      ${d.file_type ? infoItem('File Type', esc(d.file_type)) : ''}
      ${d.source_build ? infoItem('Source Build', esc(d.source_build)) : ''}
      ${d.site ? infoItem('Site', esc(d.site)) : ''}
      ${d.owner ? infoItem('Owner', esc(d.owner)) : ''}
      ${d.last_modified ? infoItem('Last Modified', esc(d.last_modified)) : ''}
    </div>
    ${d.tags?.length > 0 ? `<div style="margin-top:10px;"><div class="tag-list">${d.tags.map((t: string) => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>` : ''}
  </div>` : ''

  // ── Risk flags ──────────────────────────────────────────────
  const risks: Array<{ label: string; danger: boolean }> = d.risks || []
  const riskFlagsHTML = risks.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Risk Flags</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${risks.map(r => badge(r.label, r.danger ? COLORS.red : COLORS.orange, r.danger ? COLORS.redLight : COLORS.orangeLight)).join('')}
    </div>
  </div>` : ''

  // ── Data Sources ────────────────────────────────────────────
  const sources: any[] = d.sources || []
  const sourcesHTML = sources.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Data Sources &amp; Connections</div>
    <div style="overflow-x:auto;">
      <table class="report-table">
        <thead><tr><th>Name</th><th>Type</th><th>Mode</th><th>Server</th><th>Schema</th><th>Custom SQL</th><th>Tables</th></tr></thead>
        <tbody>${sources.map((s: any) => `
          <tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td>${esc(s.type || '—')}</td>
            <td>${s.mode === 'Live'
      ? badge('Live', COLORS.green, COLORS.greenLight)
      : badge('Extract', COLORS.orange, COLORS.orangeLight)}</td>
            <td>${esc(s.server || '—')}</td>
            <td>${esc(s.schema || '—')}</td>
            <td>${s.custom_sql ? badge('Yes', COLORS.red, COLORS.redLight) : badge('No', COLORS.green, COLORS.greenLight)}</td>
            <td>${esc(s.tables?.length ?? '—')}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>` : ''

  // ── Custom SQL ──────────────────────────────────────────────
  const customSqls: any[] = d.custom_sql_queries || []
  const customSqlHTML = customSqls.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Custom SQL Queries (${customSqls.length})</div>
    ${customSqls.map((q: any) => `
    <div class="code-block" style="margin-bottom:10px;">
      <div class="code-title">${esc(q.datasource || q.table_name || 'Query')}</div>
      <pre>${esc((q.query || '').substring(0, 500))}</pre>
      ${q.parameters?.length > 0 ? `<div style="color:#9cdcfe;font-size:11px;margin-top:6px;">Parameters: ${q.parameters.map((p: string) => esc(p)).join(', ')}</div>` : ''}
    </div>`).join('')}
  </div>` : ''

  // ── Logical relationships ───────────────────────────────────
  const logicalRels: any[] = d.model?.logical || []
  const physicalJoins: any[] = d.model?.physical || []
  const modelHTML = (logicalRels.length > 0 || physicalJoins.length > 0) ? `
  <div class="subsection">
    <div class="subsection-title">Data Model</div>
    ${logicalRels.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Logical Layer — Relationships (${logicalRels.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Cardinality</th><th>Expression</th></tr></thead>
          <tbody>${logicalRels.map((r: any) => `
            <tr>
              <td><span class="pill">${esc(r.left)}</span></td>
              <td style="text-align:center;color:${COLORS.subText};">→</td>
              <td><span class="pill">${esc(r.right)}</span></td>
              <td>${esc(r.cardinality || r.type || '—')}</td>
              <td style="font-family:monospace;font-size:10px;">${esc((r.on || r.expression || '').substring(0, 120))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    ${physicalJoins.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Physical Layer — Joins (${physicalJoins.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Left Table</th><th>Type</th><th>Right Table</th><th>Condition</th></tr></thead>
          <tbody>${physicalJoins.map((j: any) => `
            <tr>
              <td>${esc(j.left)}</td>
              <td>${badge(j.join_type || 'JOIN', COLORS.primary, COLORS.primaryLight)}</td>
              <td>${esc(j.right)}</td>
              <td style="font-family:monospace;font-size:10px;">${esc((j.condition || '').substring(0, 120))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Tables & Columns ────────────────────────────────────────
  const tables: any[] = d.tables || []
  const tablesHTML = tables.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Tables &amp; Columns (${tables.length} tables)</div>
    ${tables.map((t: any) => {
    const cols: any[] = t.columns || []
    return `
      <div style="margin-bottom:14px;border:1px solid ${COLORS.borderGray};border-radius:8px;overflow:hidden;">
        <div style="background:${COLORS.lightGray};padding:8px 14px;display:flex;align-items:center;gap:10px;">
          <strong style="font-size:13px;">${esc(t.table_name || t.name)}</strong>
          ${t.schema_name ? `<span style="font-size:11px;color:${COLORS.subText};">${esc(t.schema_name)}</span>` : ''}
          ${t.relation_type ? badge(t.relation_type, COLORS.purple, '#F4F0F9') : ''}
          <span style="font-size:11px;color:${COLORS.subText};margin-left:auto;">${cols.length} columns</span>
        </div>
        ${cols.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 14px;">
          ${cols.map((c: any) => `
          <span style="font-size:11px;background:#fff;border:1px solid ${COLORS.borderGray};border-radius:4px;padding:2px 8px;font-family:monospace;">
            ${esc(c.name)}${c.renamed_column_name && c.renamed_column_name !== c.name ? ` → ${esc(c.renamed_column_name)}` : ''} <span style="color:${COLORS.subText};">${esc(c.datatype || '')}</span>
          </span>`).join('')}
          ${cols.length > 30 ? `<span style="font-size:11px;color:${COLORS.subText};padding:2px 8px;">+${cols.length - 30} more</span>` : ''}
        </div>` : ''}
      </div>`
  }).join('')}
    
  </div>` : ''

  // ── Fields ──────────────────────────────────────────────────
  const dimensions: any[] = d.fields?.dimensions || []
  const measures: any[] = d.fields?.measures || []

  const fieldRows = (fields: any[], icon: string) => fields.map((f: any) => `
    <tr>
      <td>${esc(icon)} ${esc(f.name)}</td>
      <td>${esc(f.data_type || '—')}</td>
      <td>${esc(f.source || '—')}</td>
      <td>${esc(f.default_aggregation || '—')}</td>
      <td style="text-align:center;">${f.usage_count ?? '—'}</td>
      ${f.formula ? `<td style="font-family:monospace;font-size:10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${esc(f.formula.substring(0, 80))}</td>` : '<td>—</td>'}
    </tr>`).join('')

  const fieldsHTML = (dimensions.length > 0 || measures.length > 0) ? `
  <div class="subsection">
    <div class="subsection-title">Fields</div>
    ${dimensions.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Dimensions (${dimensions.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Data Type</th><th>Source</th><th>Aggregation</th><th>Uses</th><th>Formula</th></tr></thead>
          <tbody>${fieldRows(dimensions, '◇')}</tbody>
        </table>
        
      </div>
    </div>` : ''}
    ${measures.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Measures (${measures.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Data Type</th><th>Source</th><th>Aggregation</th><th>Uses</th><th>Formula</th></tr></thead>
          <tbody>${fieldRows(measures, '▣')}</tbody>
        </table>
        
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Calculations ────────────────────────────────────────────
  const calculations: any[] = d.calculations || []
  const lodCalcs = calculations.filter((c: any) => c.is_lod)
  const regularCalcs = calculations.filter((c: any) => !c.is_lod)

  const calcRows = (calcs: any[]) => calcs.map((c: any) => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${c.is_lod
      ? badge(c.lod_type ? `LOD – ${c.lod_type}` : 'LOD', COLORS.primary, COLORS.primaryLight)
      : esc(c.type || c.data_type || 'Calc')}</td>
      <td>${esc(c.source || '—')}</td>
      <td style="text-align:center;">${c.usage_count ?? '—'}</td>
      <td style="font-family:monospace;font-size:10px;max-width:240px;overflow:hidden;text-overflow:ellipsis;">${esc((c.formula || '').substring(0, 140))}</td>
    </tr>`).join('')

  const calculationsHTML = calculations.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Calculations (${calculations.length} total)</div>
    ${lodCalcs.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;color:${COLORS.primary};margin-bottom:8px;">LOD Expressions (${lodCalcs.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>LOD Type</th><th>Source</th><th>Uses</th><th>Formula</th></tr></thead>
          <tbody>${calcRows(lodCalcs)}</tbody>
        </table>
        
      </div>
    </div>` : ''}
    ${regularCalcs.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Regular Calculations (${regularCalcs.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Type</th><th>Source</th><th>Uses</th><th>Formula</th></tr></thead>
          <tbody>${calcRows(regularCalcs)}</tbody>
        </table>
        
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Parameters & Sets ───────────────────────────────────────
  const parameters: any[] = d.parameters || []
  const sets: any[] = d.sets || []

  const paramsHTML = (parameters.length > 0 || sets.length > 0) ? `
  <div class="subsection">
    <div class="subsection-title">Parameters &amp; Sets</div>
    ${parameters.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Parameters (${parameters.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Data Type</th><th>Current Value</th><th>Allowable Values</th></tr></thead>
          <tbody>${parameters.map((p: any) => {
    const allowableText = p.allowable_list?.length > 0
      ? `List: ${p.allowable_list.map((v: any) => esc(String(v.display_as))).join(', ')}`
      : (p.allowable_values || 'All values');
    return `
            <tr>
              <td><strong>${esc(p.name)}</strong></td>
              <td>${badge(p.data_type || '—', COLORS.primary, COLORS.primaryLight)}</td>
              <td>${esc(String(p.current_value ?? '—'))}</td>
              <td style="max-width:200px;font-size:10px;color:${COLORS.subText};">${esc(allowableText)}</td>
            </tr>`}).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
    ${sets.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:${COLORS.subText};margin-bottom:8px;">Sets (${sets.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Base Field</th><th>Type</th><th>Mode</th><th>Members</th><th>Expression</th></tr></thead>
          <tbody>${sets.map((s: any) => `
            <tr>
              <td><strong>${esc(s.name)}</strong></td>
              <td>${esc(s.base_field || '—')}</td>
              <td>${badge(s.type || '—', COLORS.primary, COLORS.primaryLight)}</td>
              <td>${esc(s.subtype || s.mode || '—')}</td>
              <td>${esc(s.member_count ?? s.count ?? '—')}</td>
              <td style="font-family:monospace;font-size:10px;">${esc((s.expression || s.condition || '—').substring(0, 80))}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Dashboards & Stories ────────────────────────────────────
  const dashboardsList: any[] = d.dashboards_list || []
  const storiesList: any[] = d.stories_list || []

  const dashStoriesHTML = (dashboardsList.length > 0 || storiesList.length > 0) ? `
  <div class="subsection">
    ${dashboardsList.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div class="subsection-title">Dashboards (${dashboardsList.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Dashboard Name</th><th>Layout</th><th>Sheets</th><th>Sheet List</th><th>Actions</th></tr></thead>
          <tbody>
            ${dashboardsList.map((d: any) => `
            <tr>
              <td style="font-weight:600;">${esc(d.name)}</td>
              <td>${esc(d.layout || '—')}</td>
              <td>${d.sheets?.length || 0} sheets</td>
              <td style="font-size:10px;color:${COLORS.subText};">${esc((d.sheets || []).join(', '))}</td>
              <td>${d.actions || 0}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
    ${storiesList.length > 0 ? `
    <div>
      <div class="subsection-title">Stories (${storiesList.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Navigator</th><th>Points</th><th>Story Points</th></tr></thead>
          <tbody>${storiesList.map((s: any) => `
            <tr>
              <td><strong>${esc(s.name)}</strong></td>
              <td>${esc(s.navigator || '—')}</td>
              <td>${esc(s.points?.length ?? 0)}</td>
              <td>${s.points?.map((p: any) => esc(p.caption || p.name || `Point ${p.index}`)).join(', ') || '—'}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Worksheets ──────────────────────────────────────────────
  const worksheets: any[] = d.worksheets || []
  const worksheetsHTML = worksheets.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Worksheets (${worksheets.length})</div>
    <div style="overflow-x:auto;">
      <table class="report-table">
        <thead><tr><th>Sheet Name</th><th>Type</th><th>Rows</th><th>Columns</th><th>Filters</th><th>Fields</th></tr></thead>
        <tbody>${worksheets.map((w: any) => `
        <tr>
          <td style="font-weight:600;">${esc(w.name)}</td>
          <td>${badge(w.mark_type || 'Unknown', COLORS.primary, COLORS.primaryLight)}</td>
          <td style="font-size:10px;">${esc((w.rows || []).join(', ')) || '—'}</td>
          <td style="font-size:10px;">${esc((w.columns || []).join(', ')) || '—'}</td>
          <td style="font-size:10px;">${esc((w.filters || []).join(', ')) || '—'}</td>
          <td style="text-align:center;">${w.fields_used || 0}</td>
        </tr>`).join('')}
      </tbody>
      </table>
      
    </div>
  </div>` : ''

  // ── Hyper Previews ──────────────────────────────────────────
  const hyperPreviews: any[] = d.hyper_previews || []
  const hyperHTML = hyperPreviews.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Hyper File Previews (${hyperPreviews.length})</div>
    ${hyperPreviews.map((hp: any) => `
    <div style="margin-bottom:10px;border:1px solid ${COLORS.borderGray};border-radius:8px;overflow:hidden;">
      <div style="background:${COLORS.lightGray};padding:7px 14px;font-size:12px;font-weight:600;">${esc(hp.hyper_file)}</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Schema</th><th>Table</th><th>Row Count</th><th>Columns</th></tr></thead>
          <tbody>
            ${(hp.details || []).map((d2: any) => `
            <tr>
              <td>${esc(d2.schema)}</td>
              <td>${esc(d2.table)}</td>
              <td>${esc(d2.row_count?.toLocaleString?.() ?? d2.row_count ?? '—')}</td>
              <td style="font-size:11px;">${(d2.columns || []).map((c: any) => `${esc(c.name)} <span style="color:${COLORS.subText};">(${esc(c.type)})</span>`).join(', ')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`).join('')}
  </div>` : ''

  // ── Embedded Assets ─────────────────────────────────────────
  const embeddedAssets: any[] = d.embedded_assets || []
  const embeddedCreds: any[] = d.embedded_credentials || []

  const assetRows = embeddedAssets.map((a: any) => `
    <tr>
      <td>${esc(a.name)}</td>
      <td>${esc(a.type || '—')}</td>
      <td>${esc(a.source || '—')}</td>
      <td>${esc(a.relative_path || '—')}</td>
      <td>${esc(typeof a.size_kb === 'number' ? `${a.size_kb.toFixed(1)} KB` : a.size_kb || '—')}</td>
      <td>${a.embedded ? badge('Embedded', COLORS.green, COLORS.greenLight) : badge('Referenced', COLORS.gray, COLORS.lightGray)}</td>
    </tr>`).join('')

  const embeddedHTML = (embeddedAssets.length > 0 || embeddedCreds.length > 0) ? `
  <div class="subsection">
    ${embeddedAssets.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div class="subsection-title">Embedded Assets (${embeddedAssets.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Name</th><th>Type</th><th>Source</th><th>Path</th><th>Size</th><th>Embedding</th></tr></thead>
          <tbody>${assetRows}</tbody>
        </table>
      </div>
    </div>` : ''}
    ${embeddedCreds.length > 0 ? `
    <div>
      <div class="subsection-title" style="color:${COLORS.red};">⚠ Embedded Credentials (${embeddedCreds.length})</div>
      <div style="overflow-x:auto;">
        <table class="report-table">
          <thead><tr><th>Connection Type</th><th>Username</th><th>Authentication</th><th>Embed Password</th></tr></thead>
          <tbody>
            ${embeddedCreds.map((c: any) => `
            <tr>
              <td>${esc(c.connection_type)}</td>
              <td>${esc(c.username)}</td>
              <td>${esc(c.authentication)}</td>
              <td>${c.embed_password ? badge('Yes — Security Risk', COLORS.red, COLORS.redLight) : badge('No', COLORS.green, COLORS.greenLight)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
  </div>` : ''

  // ── Permissions ─────────────────────────────────────────────
  const permissions: any[] = d.permissions || []
  const permHTML = permissions.length > 0 ? `
  <div class="subsection">
    <div class="subsection-title">Permissions (${permissions.length} grantees)</div>
    <div style="overflow-x:auto;">
      <table class="report-table">
        <thead><tr><th>Grantee Type</th><th>Grantee ID</th><th>Capabilities</th></tr></thead>
        <tbody>
          ${permissions.map((p: any) => `
          <tr>
            <td>${esc(p.grantee_type)}</td>
            <td style="font-family:monospace;font-size:11px;">${esc(p.grantee_id)}</td>
            <td style="font-size:11px;">${(p.capabilities || []).map((c: any) => `${esc(c.name)}:${esc(c.value)}`).join(', ')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      
    </div>
  </div>` : ''

  return `
  <div class="workbook-section">
    <div class="workbook-header" style="background:${COLORS.teal};">
      <div class="workbook-name">${wbName}</div>
      <span style="font-size:12px;opacity:.85;">Parsing Results</span>
    </div>

    ${conditionalTabSection('Summary', summaryHTML + (wbInfoHTML || ''))}
    ${riskFlagsHTML ? conditionalTabSection('Risk Flags', riskFlagsHTML) : ''}
    ${(sourcesHTML || customSqlHTML) ? conditionalTabSection('Data Sources & Connections', sourcesHTML + customSqlHTML) : ''}
    ${modelHTML ? conditionalTabSection('Data Model', modelHTML) : ''}
    ${tablesHTML ? conditionalTabSection('Tables & Columns', tablesHTML) : ''}
    ${fieldsHTML ? conditionalTabSection('Fields', fieldsHTML) : ''}
    ${calculationsHTML ? conditionalTabSection('Calculations', calculationsHTML) : ''}
    ${paramsHTML ? conditionalTabSection('Parameters & Sets', paramsHTML) : ''}
    ${dashStoriesHTML ? conditionalTabSection('Dashboards & Stories', dashStoriesHTML) : ''}
    ${worksheetsHTML ? conditionalTabSection('Worksheets', worksheetsHTML) : ''}
    ${hyperHTML ? conditionalTabSection('Hyper Previews', hyperHTML) : ''}
    ${embeddedHTML ? conditionalTabSection('Embedded Assets & Credentials', embeddedHTML) : ''}
    ${permHTML ? conditionalTabSection('Permissions', permHTML) : ''}
  </div>`
}

// ─── full HTML report ────────────────────────────────────────
export function generateMigrationReportHTML(data: MigrationReportData): string {
  const m = data.assessmentMetrics
  const totalAssets = m ? Object.values(m.assetCounts).reduce((a, b) => a + b, 0) : 0
  const maxAsset = m ? Math.max(...Object.values(m.assetCounts), 1) : 1

  const assetBars = m ? [
    { key: 'Workbooks', val: m.assetCounts.workbooks, color: COLORS.primary },
    { key: 'Data Sources', val: m.assetCounts.datasources, color: COLORS.green },
    { key: 'Tables', val: m.assetCounts.tables, color: '#C239B3' },
    { key: 'Worksheets', val: m.assetCounts.worksheets, color: '#D83B01' },
    { key: 'Dashboards', val: m.assetCounts.dashboards, color: COLORS.gray },
    { key: 'Calculations', val: m.assetCounts.calculations, color: '#8764B8' },
  ] : []

  const vizEntries = m ? Object.entries(m.vizTypeFreq)
    .sort(([, a], [, b]) => b - a) : []
  const maxViz = vizEntries.length > 0 ? vizEntries[0][1] : 1

  const totalConn = m ? m.connectionModes.live + m.connectionModes.extract : 0
  const liveP = pct(m?.connectionModes.live ?? 0, totalConn)
  const extP = pct(m?.connectionModes.extract ?? 0, totalConn)

  const totalComp = m ? (m.complexityDist.Low || 0) + (m.complexityDist.Medium || 0) + (m.complexityDist.High || 0) : 1
  const efforts = m ? {
    minutes: Math.round(m.estEffort),
    hours: Math.round(m.estEffort / 60),
    days: Math.ceil(m.estEffort / (60 * 8)),
    weeks: Math.ceil(m.estEffort / (60 * 8 * 5)),
  } : null

  const avgComp = m && m.scoredWorkbooks > 0 ? (m.totalComplexity / m.scoredWorkbooks).toFixed(1) : '—'

  // Per-workbook HTML — use stored currentRunId, fall back to first key
  const runId = data.currentRunId || Object.keys(data.assessmentData)[0] || null

  const workbooksDetailHTML = data.workbookIds.map(id =>
    workbookAssessmentHTML(id, data.assessmentData, data.parsingData, runId)
  ).join('')

  const parsingWorkbookIds = data.workbookIds.filter(id => !!data.parsingData?.[id])
  const parsingPendingCount = Math.max(0, data.workbookIds.length - parsingWorkbookIds.length)

  const parsingWorkbooksHTML = data.workbookIds.map(id =>
    workbookParsingHTML(id, data.parsingData)
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Migration Report – ${esc(data.projectName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
    font-size: 13px; 
    color: ${COLORS.text}; 
    background: #fff; 
    text-rendering: geometricPrecision !important; 
    font-kerning: normal !important; 
    letter-spacing: normal !important; 
    word-spacing: normal !important; 
    white-space: normal !important;
  }

  /* ── cover / header ── */
  .cover { background: ${COLORS.primary}; color: #fff; padding: 40px 48px 32px; margin-bottom: 32px; }
  .cover h1 { font-size: 30px; font-weight: 700; margin-bottom: 6px; }
  .cover .meta { font-size: 13px; opacity: .85; margin-top: 4px; }

  /* ── page wrapper ── */
  .page { max-width: 1100px; margin: 0 auto; padding: 0 32px 64px; }

  /* ── section ── */
  .section { margin-bottom: 40px; }
  .section-header { margin-bottom: 18px; border-left: 4px solid ${COLORS.primary}; padding-left: 12px; }
  .section-title  { font-size: 18px; font-weight: 700; color: ${COLORS.text}; }
  .section-subtitle { font-size: 12px; color: ${COLORS.subText}; margin-top: 3px; }

  /* ── metric cards ── */
  .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .metrics-grid-6 { grid-template-columns: repeat(6, 1fr); }
  .metric-card { background: #fff; border: 1px solid ${COLORS.borderGray}; border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
  .metric-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: ${COLORS.subText}; margin-bottom: 8px; }
  .metric-value { font-size: 30px; font-weight: 700; color: ${COLORS.primary}; line-height: 1; }
  .metric-sub   { font-size: 11px; color: ${COLORS.subText}; margin-top: 4px; }
  .metric-row-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }

  /* ── two-column layout ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }

  /* ── card ── */
  .card { background: #fff; border: 1px solid ${COLORS.borderGray}; border-radius: 10px; padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
  .card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .card-sub   { font-size: 11px; color: ${COLORS.subText}; margin-bottom: 16px; }

  /* ── bar charts ── */
  .bar-row   { display: grid; grid-template-columns: 110px 1fr 40px; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { font-size: 12px; color: ${COLORS.subText}; white-space: nowrap; }
  .bar-track { height: 12px; background: ${COLORS.lightGray}; border-radius: 6px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 6px; transition: width .4s; }
  .bar-val   { font-size: 12px; font-weight: 700; color: ${COLORS.text}; text-align: right; }

  /* ── complexity dist bars ── */
  .comp-bar-row   { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .comp-bar-label { width: 130px; font-size: 12px; color: ${COLORS.subText}; }
  .comp-bar-wrap  { flex: 1; }
  .comp-bar-track { height: 10px; background: ${COLORS.lightGray}; border-radius: 5px; overflow: hidden; }
  .comp-bar-fill  { height: 100%; border-radius: 5px; }
  .comp-bar-val   { font-size: 12px; font-weight: 700; color: ${COLORS.text}; white-space: nowrap; }

  /* ── risk factors ── */
  .risk-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .risk-rank { width: 24px; height: 24px; border-radius: 50%; background: ${COLORS.lightGray}; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: ${COLORS.subText}; flex-shrink: 0; }
  .risk-content { flex: 1; }
  .risk-name { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
  .risk-bar-track { height: 6px; background: ${COLORS.lightGray}; border-radius: 3px; overflow: hidden; }
  .risk-bar-fill  { height: 100%; background: ${COLORS.red}; border-radius: 3px; }
  .risk-count { font-size: 12px; color: ${COLORS.subText}; white-space: nowrap; }

  /* ── connection modes ── */
  .conn-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .conn-card { background: ${COLORS.lightGray}; border-radius: 8px; padding: 16px; text-align: center; }
  .conn-label { font-size: 11px; color: ${COLORS.subText}; margin-bottom: 6px; }
  .conn-value { font-size: 26px; font-weight: 700; color: ${COLORS.primary}; }
  .conn-pct   { font-size: 12px; color: ${COLORS.subText}; margin-top: 2px; }

  /* ── workbook sections ── */
  .workbook-section { margin-bottom: 48px; border: 1px solid ${COLORS.borderGray}; border-radius: 12px; overflow: hidden; }
  .workbook-header  { display: flex; align-items: center; justify-content: space-between; background: ${COLORS.primary}; color: #fff; padding: 16px 24px; }
  .workbook-name    { font-size: 17px; font-weight: 700; }

  /* ── tabs ── */
  .tab-section  { border-bottom: 1px solid ${COLORS.borderGray}; padding: 20px 24px; }
  .tab-section:last-child { border-bottom: none; }
  .tab-label    { font-size: 13px; font-weight: 700; color: ${COLORS.primary}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 16px; padding-bottom: 6px; border-bottom: 2px solid ${COLORS.primary}; display: inline-block; }

  /* ── sub-sections ── */
  .subsection       { margin-bottom: 20px; }
  .subsection-title { font-size: 14px; font-weight: 700; color: ${COLORS.text}; margin-bottom: 12px; }

  /* ── info grid ── */
  .info-grid  { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .info-item  { background: ${COLORS.lightGray}; border-radius: 8px; padding: 10px 14px; }
  .info-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: ${COLORS.subText}; margin-bottom: 4px; }
  .info-value { font-size: 13px; font-weight: 500; color: ${COLORS.text}; word-break: break-word; }

  /* ── table ── */
  .report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .report-table th { background: ${COLORS.lightGray}; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid ${COLORS.borderGray}; white-space: nowrap; }
  .report-table td { padding: 7px 12px; border-bottom: 1px solid ${COLORS.borderGray}; vertical-align: top; }
  .report-table tr:last-child td { border-bottom: none; }
  .report-table tr:hover td { background: ${COLORS.lightGray}; }

  /* ── color swatches ── */
  .color-swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .swatch { width: 44px; height: 44px; border-radius: 8px; border: 2px solid #e5e7eb; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,.12); overflow:hidden; }
  .swatch-label { position: absolute; bottom: 2px; left: 0; right: 0; font-size: 8px; color: #fff; text-shadow: 0 0 3px #000; text-align: center; background: rgba(0,0,0,.3); padding: 1px 0; }

  /* ── tags ── */
  .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag { background: ${COLORS.primaryLight}; color: ${COLORS.primary}; border: 1px solid ${COLORS.primary}33; border-radius: 16px; padding: 3px 12px; font-size: 12px; font-weight: 500; }

  /* ── pills ── */
  .pill { background: ${COLORS.primaryLight}; color: ${COLORS.primary}; border-radius: 4px; padding: 1px 7px; font-size: 11px; font-weight: 600; }

  /* ── risk list ── */
  .risk-list { padding-left: 20px; }
  .risk-list li { margin-bottom: 6px; font-size: 13px; }

  /* ── code block ── */
  .code-block { background: #1e1e1e; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
  .code-title { color: #d4d4d4; font-size: 11px; margin-bottom: 6px; }
  .code-block pre { color: #ce9178; font-size: 11px; white-space: pre-wrap; word-break: break-all; }

  /* ── misc ── */
  .empty-msg { color: ${COLORS.subText}; font-size: 13px; padding: 16px 0; font-style: italic; }
  .note { font-size: 11px; color: ${COLORS.subText}; margin-top: 6px; font-style: italic; }

  /* ── recommendations ── */
  .rec-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 14px; border-radius: 8px; background: ${COLORS.primaryLight}; border: 1px solid ${COLORS.primary}22; margin-bottom: 8px; }
  .rec-num  { width: 22px; height: 22px; border-radius: 50%; background: ${COLORS.primary}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 1px; }

  /* ── print ── */
  @media print {
    @page { size: A4; margin: 12mm; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 12px; }
    .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .workbook-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .section { break-inside: auto; page-break-inside: auto; }
    .section-header { break-after: avoid-page; page-break-after: avoid; }
    .workbook-section { break-inside: auto; page-break-inside: auto; }
    .workbook-header { break-after: avoid-page; page-break-after: avoid; }
    .tab-section { break-inside: auto; page-break-inside: auto; }
    .tab-label { break-after: avoid-page; page-break-after: avoid; }
    .subsection { break-inside: avoid-page; page-break-inside: avoid; }
    .report-table thead { display: table-header-group; }
    .report-table tr, svg, img { break-inside: avoid-page; page-break-inside: avoid; }
    .swatch { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bar-fill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .code-block { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-only { display: flex !important; }
  }

  /* ── print button ── */
  .print-bar { position: fixed; top: 0; left: 0; right: 0; background: ${COLORS.primary}; color: #fff; padding: 10px 32px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
  .print-btn { background: #fff; color: ${COLORS.primary}; border: none; border-radius: 6px; padding: 8px 22px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .print-btn:hover { background: #e8f3fc; }
  @media print { .print-bar { display: none; } }
  body { padding-top: 52px; }
  @media print { body { padding-top: 0; } }
  .print-only { display: none !important; }
</style>
</head>
<body>

<!-- print bar -->
<div class="print-bar no-print">
  <span style="font-weight:600;font-size:14px;">Migration Overview Report — ${esc(data.projectName)}</span>
  <button class="print-btn" onclick="window.print()">⬇ Save as PDF</button>
</div>

<div id="pdf-content">
<!-- print-only header for downloaded pdf -->
<div class="print-only" style="justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid ${COLORS.borderGray}; padding-bottom: 12px;">
  <img src="${typeof window !== 'undefined' ? window.location.origin : ''}/Switchblade_Logo.png" alt="VectorLab Logo" style="height: 36px; object-fit: contain;" />
  <div style="text-align: right; font-size: 11px; color: ${COLORS.subText};">
    <div><strong>Generated At:</strong> ${new Date().toLocaleString()}</div>
  </div>
</div>

<!-- cover -->
<div class="cover">
  <h1>Migration Overview Report</h1>
  <div class="meta">Project: <strong>${esc(data.projectName)}</strong></div>
  <div class="meta">Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString()}</div>
  <div class="meta" style="margin-top:8px;">Total Workbooks: ${data.workbookIds.length}</div>
</div>

<div class="page">

<!-- ════════════════════════════════════
     1. EXECUTIVE SUMMARY
══════════════════════════════════════ -->
<div class="section">
  ${sectionHeader('Executive Summary', 'Key metrics across all migration workbooks')}
  <div class="metrics-grid metrics-grid-6">
    ${metricCard('Workbooks', data.projectMetrics.workbooks)}
    ${metricCard('Data Sources', data.projectMetrics.datasources)}
    ${metricCard('Logical Tables', data.projectMetrics.tables)}
    ${metricCard('Measures', data.projectMetrics.measures)}
    ${metricCard('Dimensions', data.projectMetrics.dimensions)}
    ${metricCard('LOD Logic', data.projectMetrics.lods)}
  </div>
</div>

<!-- ════════════════════════════════════
     2. ASSESSMENT OVERVIEW
══════════════════════════════════════ -->
${m ? `
<div class="section">
  ${sectionHeader('Assessment Overview')}
  <div class="metrics-grid" style="grid-template-columns:repeat(4,1fr);">
    ${metricCard('Total Workbooks', m.workbooksCount)}
    ${metricCard('Data Sources', m.dataSources)}
    ${metricCard('Avg. Complexity', avgComp, 'out of 100')}
    ${metricCard('Est. Migration', efforts ? `${efforts.hours}h` : '—', efforts ? `~${efforts.days} days / ${efforts.weeks} weeks` : '')}
  </div>
</div>` : ''}

<!-- ════════════════════════════════════
     3. MATRIX + ASSET MIX
══════════════════════════════════════ -->
${m && m.matrixPoints.length > 0 ? `
<div class="section">
  ${sectionHeader('Prioritization Matrix & Estate at a Glance')}
  <div class="two-col">
    <div class="card">
      <div class="card-title">Prioritization Matrix</div>
      <div class="card-sub">Business value vs complexity — sequence migration waves</div>
      ${prioritizationMatrixSVG(m.matrixPoints)}
      <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:${COLORS.subText};">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLORS.primary};margin-right:4px;"></span>Workbooks</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${COLORS.green};margin-right:4px;"></span>Datasources</span>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Estate at a Glance</div>
      <div class="card-sub">Asset volume extracted from assessment and parsing outputs</div>
      ${assetBars.map(a => horizontalBar(a.key, a.val, maxAsset, a.color)).join('')}
    </div>
  </div>
</div>` : `
<div class="section">
  ${sectionHeader('Estate at a Glance')}
  <div class="card">
    ${assetBars.map(a => horizontalBar(a.key, a.val, maxAsset, a.color)).join('')}
  </div>
</div>`}

<!-- ════════════════════════════════════
     4. VIZ TYPES + COMPLEXITY
══════════════════════════════════════ -->
${m ? `
<div class="section">
  ${sectionHeader('Visualization Types & Estate Distribution')}
  <div class="two-col">
    <div class="card">
      <div class="card-title">Visualization Types</div>
      <div class="card-sub">Distribution of mark types across all worksheets</div>
      ${vizEntries.map(([name, count], i) =>
    horizontalBar(name, count, maxViz, VIZ_COLORS[i % VIZ_COLORS.length])
  ).join('')}
    </div>
    <div class="card">
      <div class="card-title">Estate Distribution</div>
      <div style="margin-top:8px;">
        ${[
        { label: 'Low Complexity', val: m.complexityDist.Low || 0, color: COLORS.green },
        { label: 'Medium Complexity', val: m.complexityDist.Medium || 0, color: COLORS.orange },
        { label: 'High Complexity', val: m.complexityDist.High || 0, color: COLORS.red },
      ].map(c => `
        <div class="comp-bar-row">
          <div class="comp-bar-label">${c.label}</div>
          <div class="comp-bar-wrap">
            <div class="comp-bar-track">
              <div class="comp-bar-fill" style="width:${pct(c.val, totalComp)}%;background:${c.color};"></div>
            </div>
          </div>
          <div class="comp-bar-val">${c.val} (${pct(c.val, totalComp)}%)</div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>` : ''}

<!-- ════════════════════════════════════
     5. CONNECTION MODES + RISK FACTORS
══════════════════════════════════════ -->
${m ? `
<div class="section">
  ${sectionHeader('Connection Modes & Risk Factors')}
  <div class="two-col">
    <div class="card">
      <div class="card-title">Connection Modes</div>
      <div class="conn-grid" style="margin-top:12px;">
        <div class="conn-card">
          <div class="conn-label">Live Connections</div>
          <div class="conn-value">${m.connectionModes.live}</div>
          <div class="conn-pct">${liveP}%</div>
        </div>
        <div class="conn-card">
          <div class="conn-label">Extract Connections</div>
          <div class="conn-value">${m.connectionModes.extract}</div>
          <div class="conn-pct">${extP}%</div>
        </div>
      </div>
      <div style="margin-top:16px;">
        <div class="bar-track" style="height:16px;border-radius:8px;">
          <div style="height:100%;width:${liveP}%;background:${COLORS.green};border-radius:8px 0 0 8px;display:inline-block;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:${COLORS.subText};margin-top:4px;">
          <span>Live ${liveP}%</span>
          <span>Extract ${extP}%</span>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Top Risk Factors</div>
      ${m.riskFactors.length > 0 ? m.riskFactors.map((r, i) => `
      <div class="risk-row">
        <div class="risk-rank">${i + 1}</div>
        <div class="risk-content">
          <div class="risk-name">${esc(r.name)}</div>
          <div class="risk-bar-track">
            <div class="risk-bar-fill" style="width:${pct(r.count, m.riskFactors[0]?.count || 1)}%;"></div>
          </div>
        </div>
        <div class="risk-count">${r.count} workbook${r.count !== 1 ? 's' : ''}</div>
      </div>`).join('') : ''}
    </div>
  </div>
</div>` : ''}

<!-- ════════════════════════════════════
     6. PER-WORKBOOK ASSESSMENT DETAILS
══════════════════════════════════════ -->
<div class="section">
  ${sectionHeader('Assessment Results', 'Detailed migration feasibility and complexity breakdown per workbook')}
  ${workbooksDetailHTML}
</div>

<!-- ════════════════════════════════════
     7. PARSING RESULTS
══════════════════════════════════════ -->
${parsingWorkbookIds.length > 0 ? `
<div class="section">
  ${sectionHeader('Parsing Results', 'Structural breakdown extracted from each workbook: data sources, model, fields, calculations, parameters, dashboards, assets and permissions')}
  ${parsingPendingCount > 0 ? `<div class="note" style="margin-bottom:12px;">Parsing is still in progress for ${parsingPendingCount} workbook${parsingPendingCount === 1 ? '' : 's'}.</div>` : ''}
  ${parsingWorkbooksHTML}
</div>` : ''}

<!-- ════════════════════════════════════
     8. RECOMMENDATIONS
══════════════════════════════════════ -->
<div class="section">
  ${sectionHeader('Strategic Recommendations')}
  ${[
      'Review high-complexity workbooks first and build a detailed migration plan before starting.',
      'Prioritize workbooks with few dependencies and low complexity as quick wins to build confidence.',
      'Map all custom SQL queries to their Fabric Lakehouse/Warehouse equivalents before mapping phase.',
      'Address row-level security (RLS) and permission models early — these require dedicated Power BI roles.',
      'Translate all LOD expressions carefully: FIXED, INCLUDE, and EXCLUDE map differently in DAX.',
      'Document all custom fonts and colors and prepare a Fabric theme file to preserve branding.',
      'Test extract connections thoroughly during POC — hyper files will need re-ingestion into Fabric.',
      'Run a pilot migration on a single medium-complexity workbook and validate all KPIs before batch migration.',
    ].map((r, i) => `
  <div class="rec-item">
    <div class="rec-num">${i + 1}</div>
    <div>${esc(r)}</div>
  </div>`).join('')}
</div>

</div><!-- /page -->
</div><!-- /pdf-content -->
</body>
</html>`
}

async function waitForReportRender(iframe: HTMLIFrameElement): Promise<void> {
  await new Promise<void>((resolve) => {
    const onLoad = () => {
      iframe.removeEventListener('load', onLoad)
      resolve()
    }
    iframe.addEventListener('load', onLoad)
  })

  const doc = iframe.contentDocument
  if (!doc) return

  if ('fonts' in doc && (doc as any).fonts?.ready) {
    try {
      await (doc as any).fonts.ready
    } catch {
      // Ignore font readiness failures and continue rendering.
    }
  }

  // Enforce a strict delay AFTER fonts are ready to ensure the DOM layout is completely
  // stable before html2canvas begins canvas capture. This prevents word spacing collapse.
  await new Promise(resolve => setTimeout(resolve, 500))
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  options: {
    marginMm: number;
    contentWidthMm: number;
    contentHeightMm: number;
    startOnNewPage: boolean;
    isFirstContentRef: { value: boolean };
    avoidBreakPositions?: Array<{ top: number; bottom: number }>;
  }
) {
  const { marginMm, contentWidthMm, contentHeightMm, startOnNewPage, isFirstContentRef, avoidBreakPositions } = options

  const pxPerMm = canvas.width / contentWidthMm
  const maxSlicePx = Math.max(1, Math.floor(contentHeightMm * pxPerMm))
  let offsetPx = 0
  let firstSlice = true

  while (offsetPx < canvas.height) {
    const needsPageBreak = !isFirstContentRef.value && (startOnNewPage || !firstSlice)
    if (needsPageBreak) {
      pdf.addPage()
    }

    let sliceHeightPx = Math.min(maxSlicePx, canvas.height - offsetPx)

    // --- Smart Break Logic ---
    // If this is not the last slice, check if we're cutting through a "protected" element
    if (offsetPx + sliceHeightPx < canvas.height && avoidBreakPositions) {
      const targetBottom = offsetPx + sliceHeightPx
      // Find elements that cross this horizontal line
      const intersecting = avoidBreakPositions.filter(pos => pos.top < targetBottom && pos.bottom > targetBottom)

      if (intersecting.length > 0) {
        // Try to break at the TOP of the first intersecting element
        const bestBreak = Math.min(...intersecting.map(pos => pos.top))

        // Only backtrack if we don't waste more than 85% of the page
        // (If an element is so tall it takes up almost a whole page, we must split it)
        if (bestBreak > offsetPx + (maxSlicePx * 0.15)) {
          sliceHeightPx = Math.max(1, Math.floor(bestBreak - offsetPx))
        }
      }
    }

    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeightPx

    const sliceCtx = sliceCanvas.getContext('2d')
    if (!sliceCtx) return

    sliceCtx.fillStyle = '#ffffff'
    sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    sliceCtx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)

    const sliceHeightMm = sliceHeightPx / pxPerMm
    const imgData = sliceCanvas.toDataURL('image/jpeg', 0.94)
    pdf.addImage(imgData, 'JPEG', marginMm, marginMm, contentWidthMm, sliceHeightMm, undefined, 'FAST')

    isFirstContentRef.value = false
    offsetPx += sliceHeightPx
    firstSlice = false
  }
}

async function downloadReportAsPdf(html: string, filename: string) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-10000px'
  iframe.style.top = '0'
  iframe.style.width = '1200px'
  iframe.style.height = '1600px'
  iframe.style.visibility = 'hidden'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('Failed to initialize report renderer.')

    doc.open()
    doc.write(html)
    doc.close()

    await waitForReportRender(iframe)

    const reportDoc = iframe.contentDocument
    const reportWin = iframe.contentWindow
    if (!reportDoc || !reportWin) throw new Error('Failed to access rendered report.')

    // Hide the sticky print bar for direct PDF rendering.
    reportDoc.querySelectorAll('.print-bar').forEach(el => {
      ; (el as HTMLElement).style.display = 'none'
    })
    reportDoc.body.style.paddingTop = '0'

    const reportRoot = reportDoc.querySelector('#pdf-content') as HTMLElement | null
    if (!reportRoot) throw new Error('Could not find report content section for PDF generation.')

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
    const marginMm = 8
    const contentWidthMm = 210 - marginMm * 2
    const contentHeightMm = 297 - marginMm * 2
    const firstContentRef = { value: true }

    const renderOpts = {
      scale: Math.min(2, reportWin.devicePixelRatio ? reportWin.devicePixelRatio + 0.5 : 2),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
      letterRendering: true, // Forces character-by-character rendering to prevent word collapse
    }

    const reportCanvas = await html2canvas(reportRoot, renderOpts)

    // Collect all break-sensitive positions
    const avoidBreakPositions: Array<{ top: number; bottom: number }> = []
    const rootRect = reportRoot.getBoundingClientRect()

    // We want to avoid breaking inside sections, cards, rows, or blocks of code
    const selectors = '.section, .workbook-section, .tab-section, .subsection, tr, .metric-card, .code-block, svg, .subsection-title, .info-item, .metric-row-4'
    reportRoot.querySelectorAll(selectors).forEach(el => {
      const rect = el.getBoundingClientRect()
      avoidBreakPositions.push({
        top: (rect.top - rootRect.top) * renderOpts.scale,
        bottom: (rect.bottom - rootRect.top) * renderOpts.scale
      })
    })

    addCanvasToPdf(pdf, reportCanvas, {
      marginMm,
      contentWidthMm,
      contentHeightMm,
      startOnNewPage: false,
      isFirstContentRef: firstContentRef,
      avoidBreakPositions,
    })

    pdf.save(filename)
  } finally {
    iframe.remove()
  }
}

// ─── public entry point ────────────────────────────────────────
export async function generateMigrationReport(
  data: MigrationReportData,
  filename: string = 'Migration_Report.pdf'
) {
  const html = generateMigrationReportHTML(data)

  try {
    await downloadReportAsPdf(html, filename)
    return
  } catch (err) {
    console.error('Direct PDF generation failed. Falling back to print preview.', err)
  }

  const win = window.open('', '_blank', 'width=1200,height=900')
  if (!win) {
    alert('Please allow pop-ups for this site to open the report.')
    return
  }
  win.document.write(html)
  win.document.close()
}

