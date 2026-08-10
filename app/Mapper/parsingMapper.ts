// import {
//     ParsingPayload,
//     RiskFlag,
//     DataSource,
//     DataModel,
//     FieldDef,
//     CalcField,
//     Parameter,
//     SetDef,
//     Worksheet,
//     DashboardEntry,
//     Story,
//     LogicalRelationship,
//     PhysicalJoin,
//     EmbeddedAsset,
//     EmbeddedCredential,
//     WorkbookPermission,
//     CustomSqlQuery,
//     HyperPreview,
// } from "@/components/tabs/ParsingTab"

// /**
//  * Mapper entry point — transforms raw DB JSON into ParsingPayload.
//  * Accepts the whole document ({ id, project_name, status, payload: {...} })
//  * OR just the payload object directly.
//  */
// export function mapParsingPayload(rawDoc: any): ParsingPayload {
//     if (!rawDoc) return createEmptyPayload()

//     // ── Unwrap: the DB stores everything under `payload` ──────────────────
//     const data = rawDoc.payload ?? rawDoc

//     // ── Section aliases ───────────────────────────────────────────────────
//     const meta          = data.metadata                    ?? {}
//     const fileInfo      = meta.file_info                   ?? {}
//     const perms         = data.permissions?.metadata       ?? {}
//     const dsAndConn     = data.datasources_and_connections ?? {}
//     const calcsAndLods  = data.calculations_and_lods       ?? {}
//     const paramsAndSets = data.parameters_and_sets         ?? {}
//     const sheetsAndVis  = data.sheets_and_visuals          ?? {}
//     const dashStories   = data.dashboards_and_stories      ?? {}
//     const formatting    = data.formatting_and_styling      ?? {}
//     const security      = data.security                    ?? {}
//     const embedded      = data.embedded_assets             ?? {}
//     const actions       = data.actions                     ?? []

//     // ── Fields ────────────────────────────────────────────────────────────
//     const { dimensions: dimList, measures: measList } = classifyFields(dsAndConn)

//     // ── Calculations ──────────────────────────────────────────────────────
//     const calculations = mapCalculations(calcsAndLods)
//     const lods         = calculations.filter(c => c.is_lod)
//     const lod_fixed    = lods.filter(c => c.lod_type?.toLowerCase() === "fixed").length
//     const lod_include  = lods.filter(c => c.lod_type?.toLowerCase() === "include").length
//     const lod_exclude  = lods.filter(c => c.lod_type?.toLowerCase() === "exclude").length

//     // ── Sources ───────────────────────────────────────────────────────────
//     const datasources: any[] = dsAndConn.datasources ?? []
//     const sources = datasources.map((ds: any) => mapSource(ds, dsAndConn))
//     const live    = sources.filter((s: DataSource) => s.mode === "Live").length
//     const extract = sources.filter((s: DataSource) => s.mode === "Extract").length

//     // ── Raw arrays ────────────────────────────────────────────────────────
//     const rawSheets:     any[] = sheetsAndVis.sheets        ?? []
//     const rawDashboards: any[] = dashStories.dashboards     ?? []
//     const rawStories:    any[] = dashStories.stories        ?? []
//     const dashLayouts          = formatting.dashboard_layouts ?? {} // Not used in current mapper, but available

//     return {
//         // Workbook metadata
//         workbook_name: fileInfo.name ?? rawDoc.project_name ?? data.workbook_name ?? "Unknown Workbook",
//         version:       fileInfo.version      ?? "—",
//         file_type:     fileInfo.file_type    ?? "—",
//         source_build:  fileInfo.source_build ?? "—",
//         site:          fileInfo.site         ?? "—",
//         owner:         perms.owner           ?? "—",
//         last_modified: perms.last_modified   ?? "—",

//         // Counts
//         live, extract,
//         logical: (dsAndConn.relationships ?? []).filter(
//             (r: any) => r.relationship_type === "logical"
//         ).length,
//         physical:   countPhysicalTables(dsAndConn),
//         blends:     0, // Blends not present in JSON; assume 0
//         sheets:     rawSheets.length,
//         dashboards: rawDashboards.length,
//         stories:    rawStories.length > 0 ? 1 : 0, // Assuming flat stories array represents one story
//         dimensions: dimList.length,
//         measures:   measList.length,
//         calculated: Object.keys(calcsAndLods.calculated_fields ?? {}).length,
//         lod_total:  lods.length,
//         actions:    actions.length,

//         // LOD breakdown
//         lod_fixed, lod_include, lod_exclude,

//         // Core data
//         risks:           mapRisks(data, { live, calculations, security }),
//         sources,
//         custom_sql_queries: mapCustomSqlQueries(dsAndConn.custom_sql ?? []),
//         model:           mapDataModel(dsAndConn),
//         fields:          { dimensions: dimList, measures: measList },
//         calculations,
//         parameters:      mapParameters(paramsAndSets.parameters ?? {}),
//         sets:            mapSets(paramsAndSets.sets ?? {}),
//         worksheets:      rawSheets.map(mapWorksheet),
//         dashboards_list: rawDashboards.map((db: any) => mapDashboard(db, dashLayouts)),
//         stories_list:    mapStories(rawStories, rawDashboards),
//         embedded_assets: mapEmbeddedAssets(embedded.images_and_shapes ?? {}),
//         embedded_credentials: mapEmbeddedCredentials(datasources),
//         permissions:     mapPermissions(perms.workbook_permissions ?? []),
//         tags:            perms.tags ?? [],
//         hyper_previews:  embedded.hyper_previews ?? [],
//     }
// }

// export const mapParsingApiToPayload = mapParsingPayload

// /* ─────────────────────────────────────────────────────────────────────
//    EMPTY FALLBACK
// ───────────────────────────────────────────────────────────────────── */
// function createEmptyPayload(): ParsingPayload {
//     return {
//         workbook_name: "Unknown", version: "—", file_type: "—",
//         source_build: "—", site: "—", owner: "—", last_modified: "—",
//         live: 0, extract: 0, logical: 0, physical: 0, blends: 0,
//         sheets: 0, dashboards: 0, stories: 0,
//         dimensions: 0, measures: 0, calculated: 0, lod_total: 0, actions: 0,
//         lod_fixed: 0, lod_include: 0, lod_exclude: 0,
//         risks: [], sources: [],
//         custom_sql_queries: [],
//         model: { logical: [], physical: [], blends: [] },
//         fields: { dimensions: [], measures: [] },
//         calculations: [], parameters: [], sets: [],
//         worksheets: [], dashboards_list: [], stories_list: [],
//         embedded_assets: [], embedded_credentials: [], permissions: [], tags: [],
//         hyper_previews: [],
//     }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    FIELD CLASSIFICATION
//    Numeric DB types → measures, everything else → dimensions.
// ───────────────────────────────────────────────────────────────────── */
// const NUMERIC_TYPES = new Set(["integer", "real", "double", "float", "long", "decimal", "big_int"])

// function classifyFields(dsAndConn: any) {
//     const tables: any[] = dsAndConn.tables ?? []
//     const customSql: any[] = dsAndConn.custom_sql ?? []
//     const allTables = [...tables, ...customSql]
//     const dims: FieldDef[] = []
//     const meas: FieldDef[] = []

//     for (const t of allTables) {
//         const tableName = t.table_name ?? "Unknown"
//         for (const col of (t.columns ?? [])) {
//             const field: FieldDef = {
//                 name:      col.name     ?? "Unknown",
//                 data_type: col.datatype ?? col.type?.toLowerCase() ?? "string",
//                 source:    tableName,
//                 default_aggregation: col.default_aggregation,
//             }
//             if (NUMERIC_TYPES.has(field.data_type.toLowerCase())) {
//                 meas.push(field)
//             } else {
//                 dims.push(field)
//             }
//         }
//     }

//     return { dimensions: dims, measures: meas }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    PHYSICAL TABLE COUNT
// ───────────────────────────────────────────────────────────────────── */
// function countPhysicalTables(dsAndConn: any): number {
//     const tables: any[] = dsAndConn.tables ?? []
//     return tables.filter(
//         (t: any) => t.relation_type === "physical_table"
//     ).length
// }

// /* ─────────────────────────────────────────────────────────────────────
//    DATA SOURCE MAPPER
// ───────────────────────────────────────────────────────────────────── */
// function mapSource(ds: any, dsAndConn: any): DataSource {
//     const conn: any = Array.isArray(ds.connections) ? (ds.connections[0] ?? {}) : {}
//     const allTables: any[] = dsAndConn.tables ?? []

//     const tables = allTables
//         .filter((t: any) => t.datasource === ds.name)
//         .map((t: any) => t.table_name as string)

//     const customSqlEntries: any[] = dsAndConn.custom_sql ?? []
//     const hasCustomSql = customSqlEntries.some(
//         (sql: any) => sql.datasource === ds.name
//     )

//     return {
//         id:         ds.id,
//         name:       ds.name            ?? "Unknown Source",
//         type:       ds.connection_type ?? conn.type ?? "Unknown",
//         mode:       (ds.mode === "live" ? "Live" : "Extract") as "Live" | "Extract",
//         server:     conn.server ?? conn.friendly_name ?? "—",
//         schema:     conn.schema ?? conn.database ?? null,
//         custom_sql: hasCustomSql,
//         tables,
//     }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    CUSTOM SQL QUERIES
// ───────────────────────────────────────────────────────────────────── */
// function mapCustomSqlQueries(customSql: any[]): CustomSqlQuery[] {
//     return customSql.map(sql => ({
//         datasource: sql.datasource ?? "Unknown",
//         query: sql.query ?? "",
//     }))
// }

// /* ─────────────────────────────────────────────────────────────────────
//    RISK FLAGS
// ───────────────────────────────────────────────────────────────────── */
// function mapRisks(
//     data: any,
//     stats: { live: number; calculations: CalcField[]; security: any }
// ): RiskFlag[] {
//     const risks: RiskFlag[] = []
//     const { live, calculations, security } = stats

//     const lodCount = calculations.filter(c => c.is_lod).length
//     if (lodCount > 0)
//         risks.push({ label: `${lodCount} LOD Expression${lodCount > 1 ? "s" : ""}`, danger: lodCount > 3 })

//     const customSql: number = data.datasources_and_connections?.custom_sql?.length ?? 0
//     if (customSql > 0)
//         risks.push({ label: `${customSql} Custom SQL Block${customSql > 1 ? "s" : ""}`, danger: true })

//     const hasEmbedded = (data.datasources_and_connections?.datasources ?? []).some(
//         (ds: any) => (ds.embedded_credentials ?? []).length > 0
//     )
//     if (hasEmbedded)
//         risks.push({ label: "Embedded Credentials Detected", danger: true })

//     if (security.row_level_security === false)
//         risks.push({ label: "No Row-Level Security", danger: true })

//     if (live > 0)
//         risks.push({ label: `${live} Live Connection${live > 1 ? "s" : ""}`, danger: live > 2 })

//     const unusedCalcCount = Object.values(
//         data.calculations_and_lods?.calculated_fields ?? {}
//     ).filter((c: any) => (c?.usage_count ?? 1) === 0).length
//     if (unusedCalcCount > 0)
//         risks.push({
//             label: `${unusedCalcCount} Unused Calculated Field${unusedCalcCount > 1 ? "s" : ""}`,
//             danger: unusedCalcCount > 3,
//         })

//     const m2mCount = (data.datasources_and_connections?.relationships ?? []).filter(
//         (r: any) => r.cardinality === "many-to-many"
//     ).length
//     if (m2mCount > 0)
//         risks.push({
//             label: `${m2mCount} Many-to-Many Relationship${m2mCount > 1 ? "s" : ""}`,
//             danger: m2mCount > 1,
//         })

//     if (risks.length === 0)
//         risks.push({ label: "Low Complexity Workbook", danger: false })

//     return risks
// }

// /* ─────────────────────────────────────────────────────────────────────
//    DATA MODEL
// ───────────────────────────────────────────────────────────────────── */
// function mapDataModel(dsAndConn: any): DataModel {
//     const rels: any[] = dsAndConn.relationships ?? []

//     const logical: LogicalRelationship[] = rels
//         .filter((r: any) => r.relationship_type === "logical")
//         .map((r: any) => ({
//             left:  r.from_table ?? "—",
//             right: r.to_table   ?? "—",
//             on: Array.isArray(r.join_conditions)
//                 ? r.join_conditions
//                     .map((c: any) => `${c.left} ${c.operator ?? "="} ${c.right}`)
//                     .join(" AND ")
//                 : "—",
//             type: r.cardinality ?? r.relationship_type ?? "—",
//             cardinality: r.cardinality ?? "—",
//         }))

//     const physical: PhysicalJoin[] = [] // Physical joins not explicitly listed; assume empty if not present

//     return { logical, physical, blends: [] }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    CALCULATIONS + LODs
// ───────────────────────────────────────────────────────────────────── */
// function mapCalculations(calcsAndLods: any): CalcField[] {
//     const out: CalcField[] = []

//     // Calculated fields
//     for (const [name, val] of Object.entries(calcsAndLods.calculated_fields ?? {}) as [string, any][]) {
//         out.push({
//             name:        val.name        ?? name,
//             formula:     val.formula     ?? "",
//             is_lod:      false,
//             data_type:   val.datatype,
//             usage_count: val.usage_count ?? 0,
//             source:      val.default_aggregation ? `agg: ${val.default_aggregation}` : undefined,
//         })
//     }

//     // LOD expressions
//     for (const [name, val] of Object.entries(calcsAndLods.lod_expressions ?? {}) as [string, any][]) {
//         out.push({
//             name:        val.name    ?? name,
//             formula:     val.formula ?? "",
//             is_lod:      true,
//             data_type:   val.datatype,
//             usage_count: val.usage_count ?? 0,
//             lod_type:    val.lod_type,
//             source:      Array.isArray(val.dependencies) && val.dependencies.length
//                 ? `deps: ${val.dependencies.join(", ")}`
//                 : undefined,
//         } as CalcField)
//     }

//     return out
// }

// /* ─────────────────────────────────────────────────────────────────────
//    PARAMETERS
// ───────────────────────────────────────────────────────────────────── */
// function mapParameters(params: any): Parameter[] {
//     return Object.entries(params).map(([name, val]: [string, any]): Parameter => {
//         const a = val.allowable ?? {}
//         let allowable = "All values"
//         if (a.type === "range") {
//             allowable = `Range: ${a.min ?? "?"} – ${a.max ?? "?"}`
//             if (a.step) allowable += ` (step: ${a.step})`
//         } else if (a.type === "list") {
//             allowable = `List: ${(a.values ?? []).map(v => v.display_as ?? v.value).join(", ")}`
//         }

//         return {
//             name:             val.name         ?? name,
//             data_type:        val.datatype      ?? "string",
//             current_value:    val.current_value ?? "—",
//             allowable_values: allowable,
//         }
//     })
// }

// /* ─────────────────────────────────────────────────────────────────────
//    SETS
// ───────────────────────────────────────────────────────────────────── */
// function mapSets(sets: any): SetDef[] {
//     return Object.entries(sets).map(([name, val]: [string, any]): SetDef => ({
//         name:       val.name     ?? name,
//         base_field: val.base_field ?? "—",
//         type:       val.type ?? val.subtype ?? "—",
//         condition:  val.expression ?? val.condition ?? (val.selected_members ? val.selected_members.join(", ") : "—"),
//     }))
// }

// /* ─────────────────────────────────────────────────────────────────────
//    WORKSHEET
// ───────────────────────────────────────────────────────────────────── */
// function mapWorksheet(w: any): Worksheet {
//     const rows    = Array.isArray(w.rows)    ? w.rows    : []
//     const columns = Array.isArray(w.columns) ? w.columns : []
//     const filters = Array.isArray(w.filters)
//         ? w.filters.map((f: any) =>
//             typeof f === "string" ? f : (f.name ?? String(f))
//         )
//         : []
//     const filters_detail = w.filters?.map((f: any) => ({
//         name: f.name ?? "Unknown",
//         type: f.type ?? "Unknown",
//     })) ?? []

//     return {
//         name:        w.name     ?? "Unknown Sheet",
//         sheet_id:    w.sheet_id ?? "",
//         type:        w.type     ?? "worksheet",
//         mark_type:   w.mark_type ?? "Automatic",
//         rows,
//         columns,
//         filters,
//         filters_detail,
//         fields_used: rows.length + columns.length,
//         actions:     0, // Actions are top-level; not per sheet
//         colors:      w.formatting?.colors ?? [],
//         fonts:       w.formatting?.fonts ?? [],
//         tooltips:    w.formatting?.tooltip_formatting ?? [],
//         axis_formatting: w.formatting?.axis_formatting ?? [],
//         borders:     w.formatting?.borders ?? [],
//     }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    DASHBOARD
// ───────────────────────────────────────────────────────────────────── */
// function mapDashboard(db: any, dashLayouts: any): DashboardEntry {
//     const objects: any[] = db.dashboard_objects ?? []

//     // Approximate width/height from layout; fallback to 0
//     let maxW = 0, maxH = 0
//     // In this JSON, no position info; assume defaults or skip calculation
//     // For now, set to 0 as placeholder

//     const sheets: string[] = [
//         ...new Set(objects.map((o: any) => o as string)),
//     ]

//     const device_layout = db.device_layouts?.map((l: string) => l.split(" (")[0]).join(", ") ?? "Default"

//     const actionsList = db.actions?.map((a: string) => ({
//         name: a,
//         activation: "on-select", // Default assumption
//     })) ?? []

//     return {
//         name:          db.dashboard_name ?? "Unknown Dashboard",
//         width:         maxW,
//         height:        maxH,
//         device_layout: device_layout,
//         sheets,
//         actions:       db.actions?.length ?? 0,
//         actionsList,
//         layout:        db.layout_mode ?? "tiled",
//         containers:    db.containers ?? 0,
//     }
// }

// /* ─────────────────────────────────────────────────────────────────────
//    STORIES
// ───────────────────────────────────────────────────────────────────── */
// function mapStories(rawStories: any[], rawDashboards: any[]): Story[] {
//     if (rawStories.length === 0) return []

//     // Find the story dashboard; assume one with "Story" in name
//     const storyDash = rawDashboards.find(db => db.dashboard_name?.includes("Story")) ?? { dashboard_name: "Unknown Story" }

//     return [{
//         name:      storyDash.dashboard_name ?? "Unknown Story",
//         navigator: "—", // Not specified in JSON
//         points:    rawStories.map((p: any, i: number) => ({
//             index:   p.point_number ?? i + 1,
//             caption: p.caption ?? `Point ${i + 1}`,
//             content: p.source_content ?? "—",
//         })),
//     }]
// }

// /* ─────────────────────────────────────────────────────────────────────
//    EMBEDDED ASSETS
// ───────────────────────────────────────────────────────────────────── */
// function mapEmbeddedAssets(assets: any): EmbeddedAsset[] {
//     const images: any[] = assets.images ?? []
//     const shapes: any[] = assets.custom_shapes ?? []

//     return [
//         ...images.map(img => ({
//             name: img.name,
//             source: img.source,
//             embedded: img.embedded,
//             relative_path: img.relative_path,
//             size_kb: img.size_kb,
//             type: "image",
//         })),
//         ...shapes.map(shape => ({
//             name: shape.name,
//             source: shape.source,
//             embedded: shape.embedded,
//             relative_path: shape.relative_path,
//             size_kb: shape.size_kb,
//             type: "shape",
//             palette: shape.palette,
//             mapped_to: shape.mapped_to,
//         })),
//     ]
// }

// /* ─────────────────────────────────────────────────────────────────────
//    EMBEDDED CREDENTIALS
// ───────────────────────────────────────────────────────────────────── */
// function mapEmbeddedCredentials(datasources: any[]): EmbeddedCredential[] {
//     return datasources.flatMap(ds => ds.embedded_credentials ?? [])
// }

// /* ─────────────────────────────────────────────────────────────────────
//    PERMISSIONS
// ───────────────────────────────────────────────────────────────────── */
// function mapPermissions(perms: any[]): WorkbookPermission[] {
//     return perms.map(perm => ({
//         grantee_type: perm.grantee_type ?? "Unknown",
//         grantee_id: perm.grantee_id ?? "Unknown",
//         capabilities: perm.capabilities ?? [],
//     }))
// }

import {
    ParsingPayload,
    RiskFlag,
    DataSource,
    DataModel,
    FieldDef,
    CalcField,
    Parameter,
    SetDef,
    Worksheet,
    DashboardEntry,
    Story,
    LogicalRelationship,
    PhysicalJoin,
    EmbeddedAsset,
    EmbeddedCredential,
    WorkbookPermission,
    CustomSqlQuery,
    HyperPreview,
} from "@/components/tabs/ParsingTab"

export function mapParsingPayload(rawDoc: any): ParsingPayload {
    if (!rawDoc) return createEmptyPayload()

    const data = rawDoc.payload ?? rawDoc
    const meta = data.metadata ?? {}
    const fileInfo = meta.file_info ?? {}
    const perms = data.permissions?.metadata ?? {}
    const dsAndConn = data.datasources_and_connections ?? {}
    const calcsAndLods = data.calculations_and_lods ?? {}
    const paramsAndSets = data.parameters_and_sets ?? {}
    const sheetsAndVis = data.sheets_and_visuals ?? {}
    const dashStories = data.dashboards_and_stories ?? {}
    const embedded = data.embedded_assets ?? {}

    const { dimensions, measures } = classifyFields(dsAndConn)
    const calculations = mapCalculations(calcsAndLods)
    const datasources = dsAndConn.datasources ?? []
    const sources = datasources.map((ds: any) => mapSource(ds, dsAndConn))

    return {
        workbook_name: fileInfo.name ?? "Unknown Workbook",
        version: fileInfo.version ?? "—",
        file_type: fileInfo.file_type ?? "—",
        source_build: fileInfo.source_build ?? "—",
        site: fileInfo.site ?? "—",
        owner: perms.owner ?? "—",
        last_modified: perms.last_modified ?? "—",
        live: sources.filter((s: DataSource) => s.mode === "Live").length,
        extract: sources.filter((s: DataSource) => s.mode === "Extract").length,
        logical: (dsAndConn.relationships ?? []).length,
        physical: (dsAndConn.tables ?? []).filter((t: any) => t.relation_type === "physical_table").length,
        blends: 0,
        sheets: (sheetsAndVis.sheets ?? []).length,
        dashboards: (dashStories.dashboards ?? []).length,
        stories: (dashStories.stories ?? []).length > 0 ? 1 : 0,
        dimensions: dimensions.length,
        measures: measures.length,
        calculated: Object.keys(calcsAndLods.calculated_fields ?? {}).length,
        lod_total: calculations.filter(c => c.is_lod).length,
        actions: (data.actions ?? []).length,
        lod_fixed: calculations.filter(c => c.lod_type?.toLowerCase() === "fixed").length,
        lod_include: calculations.filter(c => c.lod_type?.toLowerCase() === "include").length,
        lod_exclude: calculations.filter(c => c.lod_type?.toLowerCase() === "exclude").length,
        risks: mapRisks(data, calculations),
        sources,
        custom_sql_queries: (dsAndConn.custom_sql ?? []).map((sql: any) => ({ datasource: sql.datasource, query: sql.query })),
        model: mapDataModel(dsAndConn),
        fields: { dimensions, measures },
        calculations,
        parameters: mapParameters(paramsAndSets.parameters ?? {}),
        sets: mapSets(paramsAndSets.sets ?? {}),
        worksheets: (sheetsAndVis.sheets ?? []).map(mapWorksheet),
        dashboards_list: (dashStories.dashboards ?? []).map(mapDashboard),
        stories_list: mapStories(dashStories.stories ?? [], dashStories.dashboards ?? []),
        embedded_assets: mapEmbeddedAssets(embedded.images_and_shapes ?? {}),
        embedded_credentials: datasources.flatMap((ds: any) => ds.embedded_credentials ?? []),
        permissions: (perms.workbook_permissions ?? []).map((p: any) => ({ grantee_type: p.grantee_type, grantee_id: p.grantee_id, capabilities: p.capabilities })),
        tags: perms.tags ?? [],
        hyper_previews: embedded.hyper_previews ?? [],
    }
}

function classifyFields(dsAndConn: any) {
    const allTables = [...(dsAndConn.tables ?? []), ...(dsAndConn.custom_sql ?? [])]
    const dimensions: FieldDef[] = []
    const measures: FieldDef[] = []
    const NUMERIC = new Set(["integer", "real", "double", "float", "long", "decimal"])

    allTables.forEach(t => {
        (t.columns ?? []).forEach((c: any) => {
            const f = { name: c.name, data_type: c.datatype ?? "string", source: t.table_name };
            if (NUMERIC.has(f.data_type.toLowerCase())) measures.push(f);
            else dimensions.push(f);
        });
    });
    return { dimensions, measures };
}

function mapSource(ds: any, dsAndConn: any): DataSource {
    const conn = ds.connections?.[0] ?? {};
    return {
        name: ds.name ?? "Unknown",
        type: ds.connection_type ?? "Unknown",
        mode: ds.mode === "live" ? "Live" : "Extract",
        server: conn.server ?? "—",
        schema: conn.schema ?? null,
        custom_sql: (dsAndConn.custom_sql ?? []).some((s: any) => s.datasource === ds.name),
        tables: (dsAndConn.tables ?? []).filter((t: any) => t.datasource === ds.name).map((t: any) => t.table_name),
        connections: Array.isArray(ds.connections) ? ds.connections : []
    };
}

function mapParameters(params: any): Parameter[] {
    return Object.entries(params).map(([name, val]: [string, any]) => {
        const a = val.allowable ?? {};
        let allowable = "All values";
        if (a.type === "list") allowable = `List: ${(a.values ?? []).map((v: any) => `${v.display_as} (${v.value})`).join(", ")}`;
        return { name: val.name ?? name, data_type: val.datatype, current_value: val.current_value, allowable_values: allowable };
    });
}

function mapSets(sets: any): SetDef[] {
    return Object.entries(sets).map(([name, val]: [string, any]) => ({
        name: val.name ?? name,
        base_field: val.base_field ?? "—",
        type: val.type ?? "—",
        subtype: val.subtype,
        mode: val.mode,
        count: val.count,
        condition: val.expression ?? val.condition ?? "—",
        selected_members: val.selected_members ?? [],
        member_count: val.member_count
    }));
}

function mapWorksheet(w: any): Worksheet {
    return {
        name: w.name,
        sheet_id: w.sheet_id,
        type: w.type,
        mark_type: w.mark_type,
        rows: w.rows ?? [],
        columns: w.columns ?? [],
        filters_detail: w.filters?.map((f: any) => ({ name: f.name, type: f.type })) ?? [],
        visual_properties: w.visual_properties,
        marks_text: w.marks_text ?? [],
        marks_color: w.marks_color ?? [],
        marks_detail: w.marks_detail ?? [],
        marks_size: w.marks_size ?? [],
        tooltips: w.tooltip_formatting ?? [],
        axis_formatting: w.axis_formatting ?? [],
        borders: w.borders ?? [],
        fields_used: (w.rows?.length || 0) + (w.columns?.length || 0),
        actions: 0
    };
}

function mapDashboard(db: any): DashboardEntry {
    return {
        name: db.dashboard_name,
        layout: db.layout_mode,
        containers_list: db.containers ?? [],
        objects: db.dashboard_objects ?? [],
        device_layouts: db.device_layouts ?? [],
        actionsList: (db.actions ?? []).map((a: string) => ({ name: a, activation: "on-select" }))
    } as any;
}

function mapStories(rawStories: any[], rawDashboards: any[]): Story[] {
    if (!rawStories || rawStories.length === 0) return [];

    return rawStories.map((story: any, idx: number) => ({
        // Map the correct story_name from the new payload
        name: story.story_name || rawDashboards.find(d => d.dashboard_name?.includes("Story"))?.dashboard_name || `Story ${idx + 1}`,
        
        // Dynamically pull navigator_style, mapping to the 'navigator' prop
        navigator: story.navigator_style || "—",
        
        // Properly loop over the nested story_points array
        points: (story.story_points || []).map((p: any, pIdx: number) => ({
            index: p.point_number || pIdx + 1,
            caption: p.caption || "—",
            content: p.source_content || "—"
        }))
    }));
}

function mapDataModel(dsAndConn: any): DataModel {
    return {
        logical: (dsAndConn.relationships ?? []).map((r: any) => ({
            left: r.from_table, right: r.to_table, cardinality: r.cardinality,
            on: (r.join_conditions ?? []).map((c: any) => `${c.left} = ${c.right}`).join(" AND "),
            type: "Logical"
        })),
        physical: [], blends: []
    };
}

function mapCalculations(calcs: any): CalcField[] {
    const out: CalcField[] = [];
    Object.entries(calcs.calculated_fields ?? {}).forEach(([n, v]: [string, any]) => out.push({ name: v.name ?? n, formula: v.formula, is_lod: false, data_type: v.datatype }));
    Object.entries(calcs.lod_expressions ?? {}).forEach(([n, v]: [string, any]) => out.push({ name: v.name ?? n, formula: v.formula, is_lod: true, data_type: v.datatype, lod_type: v.lod_type }));
    return out;
}

function mapRisks(data: any, calcs: CalcField[]): RiskFlag[] {
    const risks: RiskFlag[] = [];
    if (calcs.filter(c => c.is_lod).length > 3) risks.push({ label: "High LOD Complexity", danger: true });
    if (data.datasources_and_connections?.custom_sql?.length > 0) risks.push({ label: "Custom SQL Used", danger: true });
    return risks;
}

function mapEmbeddedAssets(assets: any): EmbeddedAsset[] {
    return [
        ...(assets.images ?? []).map((i: any) => ({ ...i, type: "image" })),
        ...(assets.custom_shapes ?? []).map((s: any) => ({ ...s, type: "shape" }))
    ];
}

function createEmptyPayload(): ParsingPayload {
    return { workbook_name: "Unknown", live: 0, extract: 0, logical: 0, physical: 0, blends: 0, sheets: 0, dashboards: 0, stories: 0, dimensions: 0, measures: 0, calculated: 0, lod_total: 0, actions: 0, lod_fixed: 0, lod_include: 0, lod_exclude: 0, risks: [], sources: [], custom_sql_queries: [], model: { logical: [], physical: [], blends: [] }, fields: { dimensions: [], measures: [] }, calculations: [], parameters: [], sets: [], worksheets: [], dashboards_list: [], stories_list: [], embedded_assets: [], embedded_credentials: [], permissions: [], tags: [], hyper_previews: [], version: "—", file_type: "—", source_build: "—", site: "—", owner: "—", last_modified: "—" };
}