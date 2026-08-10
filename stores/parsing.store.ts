import { create } from 'zustand'
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
    StoryPoint,
    EmbeddedAsset,
    EmbeddedCredential,
    WorkbookPermission,
    CustomSqlQuery,
    LayoutNode,
    HyperPreview
} from '@/components/tabs/ParsingTab'
import { parsingService } from '@/services/parsing.service'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

function extractCredentials(obj: any): any[] {
    let creds: any[] = [];
    const search = (node: any) => {
        if (!node || typeof node !== 'object') return;

        if (node.embedded_credentials) {
            if (Array.isArray(node.embedded_credentials)) {
                creds.push(...node.embedded_credentials);
            } else if (typeof node.embedded_credentials === 'object') {
                creds.push(node.embedded_credentials);
            }
        }

        if (Array.isArray(node)) {
            node.forEach(search);
        } else {
            Object.values(node).forEach(search);
        }
    };
    search(obj);
    return creds;
}

const safeExtract = (arr: any[]) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
            if (item.color) return item.color;
            if (item.font) return item.font;
            if (item.name) return item.name;
            if (item.value) return item.value;
            if (item.hex) return item.hex;

            const keys = Object.keys(item);
            if (keys.length === 1) return keys[0];

            return JSON.stringify(item);
        }
        return String(item);
    });
};

function flattenLayouts(nodes: any[], level = 0): LayoutNode[] {
    let result: LayoutNode[] = [];
    if (!nodes) return result;

    const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

    for (const node of nodeArray) {
        if (!node || typeof node !== 'object') continue;

        // 👇 FIXED: Added strict checks for XML dictionary formats like @attributes or $
        const attrs = node.attributes || node["@attributes"] || node["$"] || {};

        if (attrs.id || attrs.name || node.name || node.id || node.type || attrs.type || attrs["type-v2"] || attrs.h || attrs.w) {
            result.push({
                id: String(attrs.id || node.id || "—"),
                name: String(attrs.name || node.name || "—"),
                type: String(attrs["type-v2"] || attrs.type || node.type || "—"),
                x: String(attrs.x !== undefined ? attrs.x : "0"),
                y: String(attrs.y !== undefined ? attrs.y : "0"),
                w: String(attrs.w !== undefined ? attrs.w : "0"),
                h: String(attrs.h !== undefined ? attrs.h : "0"),
                style: node.style || attrs.style || {},
                layout_cache: node.layout_cache || attrs.layout_cache || node.layout_options || {},
                level: level
            });
        }

        if (node.children && Array.isArray(node.children)) {
            result.push(...flattenLayouts(node.children, level + 1));
        } else if (node.layout && Array.isArray(node.layout)) {
            result.push(...flattenLayouts(node.layout, level + 1));
        }
    }
    return result;
}

function deepSearchByKey(node: any, targetKey: string, visited = new Set()): any[] {
    if (!node || typeof node !== 'object') return [];
    if (visited.has(node)) return [];
    visited.add(node);

    if (Array.isArray(node[targetKey]) && node[targetKey].length > 0) {
        return node[targetKey];
    }

    for (const key of Object.keys(node)) {
        const found = deepSearchByKey(node[key], targetKey, visited);
        if (found.length > 0) return found;
    }

    return [];
}

export function mapParsingPayload(rawDoc: any): ParsingPayload {
    if (!rawDoc) return createEmptyPayload()

    const data = rawDoc.payload || rawDoc.data || rawDoc
    const meta = data.metadata || {}
    const fileInfo = meta.file_info || {}
    const perms = data.permissions?.metadata || {}
    const dsAndConn = data.datasources_and_connections || {}
    const calcsAndLods = data.calculations_and_lods || {}
    const paramsAndSets = data.parameters_and_sets || {}
    const sheetsAndVis = data.sheets_and_visuals || {}
    const dashStories = data.dashboards_and_stories || {}
    const formatting = data.formatting_and_styling || {}
    const security = data.security || {}

    const { dimensions: dimList, measures: measList } = classifyFields(calcsAndLods)

    const calculations = mapCalculations(calcsAndLods)
    const lods = calculations.filter(c => c.is_lod)
    const lod_fixed = lods.filter(c => c.lod_type?.toLowerCase() === "fixed").length
    const lod_include = lods.filter(c => c.lod_type?.toLowerCase() === "include").length
    const lod_exclude = lods.filter(c => c.lod_type?.toLowerCase() === "exclude").length

    const datasources: any[] = dsAndConn.datasources ?? []
    const sources = datasources.map((ds: any) => mapSource(ds, dsAndConn))
    const live = sources.filter((s: DataSource) => s.mode === "Live").length
    const extract = sources.filter((s: DataSource) => s.mode === "Extract").length

    const customSqlEntries: any[] = dsAndConn.custom_sql ?? dsAndConn.logical_tables?.custom_sql ?? dsAndConn.logical_tables?.tables?.custom_sql ?? [];
    const mappedCustomSqlQueries: CustomSqlQuery[] = customSqlEntries
        .filter((sql: any) => sql.query)
        .map((sql: any) => ({
            datasource: sql.datasource || sql.datasource_id || sql.table_name || "Unknown Datasource",
            table_name: sql.table_name || null,
            query: sql.query,
            parameters: Array.isArray(sql.parameters) ? sql.parameters : []
        }));

    const rawSheets: any[] = sheetsAndVis.sheets ?? []
    const rawDashboards: any[] = dashStories.dashboards ?? []

    let rawStories: any[] = [];
    const extractStories = (source: any) => {
        if (!source) return [];
        if (Array.isArray(source)) return source;
        if (typeof source === 'object') {
            return Object.entries(source).map(([k, v]: [string, any]) => {
                if (typeof v === 'object' && v !== null) return { name: k, ...v };
                return { name: k, content: String(v) };
            });
        }
        return [];
    };

    rawStories = extractStories(data.stories);
    if (rawStories.length === 0) rawStories = extractStories(dashStories.stories);
    if (rawStories.length === 0) rawStories = extractStories(sheetsAndVis.stories);
    if (rawStories.length === 0) {
        const deepFound = deepSearchByKey(rawDoc, 'stories');
        if (deepFound && deepFound.length > 0) rawStories = deepFound;
    }

    const dashLayouts = formatting.dashboard_layouts || data.dashboard_layouts || sheetsAndVis.dashboard_layouts || {}
    // Collect worksheet formatting from ALL possible paths (check length, not just nullish)
    const findFormattingArray = (...sources: any[]): any[] => {
        for (const src of sources) {
            if (Array.isArray(src) && src.length > 0) return src;
        }
        return [];
    };
    let worksheetFormatting = findFormattingArray(
        formatting.worksheet_formatting,
        formatting.sheets_formatting,
        formatting.formatting,
        sheetsAndVis.formatting,
        sheetsAndVis.worksheet_formatting,
        sheetsAndVis.sheets_formatting,
        data.formatting,
        data.worksheet_formatting,
        data.sheets_formatting
    );
    // Last resort: deep search the entire raw JSON for formatting arrays with sheet_name
    if (worksheetFormatting.length === 0) {
        for (const searchKey of ['formatting', 'worksheet_formatting', 'sheets_formatting']) {
            const deepFmt = deepSearchByKey(rawDoc, searchKey);
            if (Array.isArray(deepFmt) && deepFmt.length > 0 && deepFmt[0]?.sheet_name) {
                worksheetFormatting = deepFmt;
                break;
            }
        }
    }
    // Nuclear fallback: if raw sheet objects themselves have tooltip_formatting/colors_used, 
    // build the formatting list directly from the sheets array
    if (worksheetFormatting.length === 0 && rawSheets.some((s: any) =>
        (Array.isArray(s.tooltip_formatting) && s.tooltip_formatting.length > 0) ||
        (Array.isArray(s.colors_used) && s.colors_used.length > 0) ||
        (Array.isArray(s.axis_formatting) && s.axis_formatting.length > 0)
    )) {
        worksheetFormatting = rawSheets.map((s: any) => ({
            sheet_name: s.name || s.sheet_name,
            colors_used: s.colors_used || [],
            fonts_used: s.fonts_used || [],
            borders: s.borders || [],
            axis_formatting: s.axis_formatting || [],
            tooltip_formatting: s.tooltip_formatting || [],
        }));
    }

    const embeddedImagesRaw = data.embedded_assets?.images_and_shapes?.images || []
    const embeddedShapesRaw = data.embedded_assets?.images_and_shapes?.['custom shapes'] || data.embedded_assets?.images_and_shapes?.custom_shapes || []

    const embeddedAssets: EmbeddedAsset[] = [
        ...embeddedImagesRaw.map((img: any) => ({
            name: img.name || "Unknown Asset",
            source: img.source || "workspace",
            embedded: !!img.embedded,
            relative_path: img.relative_path || "—",
            size_kb: img.size_kb || 0,
            type: "image"
        })),
        ...embeddedShapesRaw.map((shape: any) => ({
            name: shape.name || "Unknown Shape",
            source: shape.source || "xml",
            embedded: !!shape.embedded,
            relative_path: shape.relative_path || "—",
            size_kb: shape.size_kb || 0,
            type: "shape",
            palette: shape.palette || "—",
            mapped_to: shape.mapped_to || "—"
        }))
    ]

    const allCreds = extractCredentials(data);
    const uniqueCredsMap = new Map();
    allCreds.forEach(c => {
        const key = `${c.connection_type || c.type}-${c.username}-${c.authentication || c.auth_type}`;
        if (!uniqueCredsMap.has(key)) {
            uniqueCredsMap.set(key, c);
        }
    });

    const mappedEmbeddedCreds: EmbeddedCredential[] = Array.from(uniqueCredsMap.values()).map((cred: any) => ({
        connection_type: cred.connection_type || cred.type || "Unknown",
        username: cred.username || "—",
        authentication: cred.authentication || cred.auth_type || "—",
        embed_password: !!cred.embed_password || !!cred.embedded_password
    }))

    let rawHyperPreviews: any[] = [];
    if (Array.isArray(data.hyper_previews) && data.hyper_previews.length > 0) rawHyperPreviews = data.hyper_previews;
    else if (data.embedded_assets && Array.isArray(data.embedded_assets.hyper_previews) && data.embedded_assets.hyper_previews.length > 0) rawHyperPreviews = data.embedded_assets.hyper_previews;
    else rawHyperPreviews = deepSearchByKey(rawDoc, 'hyper_previews');

    let rawTables: any[] = [];
    if (Array.isArray(data.tables) && data.tables.length > 0) rawTables = data.tables;
    else if (dsAndConn.tables && Array.isArray(dsAndConn.tables)) rawTables = dsAndConn.tables;
    else rawTables = deepSearchByKey(rawDoc, 'tables');

    const mappedHyperPreviews: HyperPreview[] = rawHyperPreviews.map((hp: any) => ({
        hyper_file: hp.hyper_file || "Unknown Hyper File",
        details: Array.isArray(hp.details) ? hp.details.map((d: any) => ({
            schema: d.schema || "Unknown",
            table: d.table || "Unknown",
            row_count: d.row_count !== undefined ? Number(d.row_count) : 0,
            // 👇 Added exact column mapping from your JSON
            columns: Array.isArray(d.columns) ? d.columns.map((c: any) => ({
                name: c.name || "Unknown",
                type: c.type || "Unknown"
            })) : []
        })) : []
    }));

    const rawPerms = perms.workbook_permissions || []
    const mappedPerms: WorkbookPermission[] = rawPerms.map((p: any) => {
        const caps = p.capabilities || {};
        return {
            grantee_type: p.grantee_type || "Unknown",
            grantee_id: p.grantee_id || "Unknown",
            capabilities: Object.entries(caps).map(([k, v]) => ({ name: k, value: String(v) }))
        }
    })

    const mappedTags = Array.isArray(perms.tags) ? perms.tags : Array.isArray(data.tags) ? data.tags : [];

    return {
        workbook_name: fileInfo.name ?? rawDoc.project_name ?? data.workbook_name ?? "Unknown Workbook",
        version: fileInfo.version ?? "—",
        file_type: fileInfo.file_type ?? "—",
        source_build: fileInfo.source_build ?? "—",
        site: fileInfo.site ?? "—",
        owner: perms.owner ?? "—",
        last_modified: perms.last_modified ?? "—",

        live, extract,
        logical: (dsAndConn.relationships ?? []).filter((r: any) => r.relationship_type === "logical").length,
        physical: countPhysicalTables(dsAndConn),
        blends: 0,
        sheets: rawSheets.length,
        dashboards: rawDashboards.length,
        stories: rawStories.length,
        dimensions: dimList.length,
        measures: measList.length,
        calculated: Object.keys(calcsAndLods.calculated_fields ?? {}).length,
        lod_total: lods.length,
        actions: (data.actions ?? []).length,

        lod_fixed, lod_include, lod_exclude,

        risks: mapRisks(data, { live, calculations, security }),
        sources,
        custom_sql_queries: mappedCustomSqlQueries,
        model: mapDataModel(dsAndConn),
        fields: { dimensions: dimList, measures: measList },
        calculations,
        parameters: mapParameters(paramsAndSets.parameters ?? {}),
        sets: mapSets(paramsAndSets.sets ?? {}),
        worksheets: rawSheets.map((w: any) => mapWorksheet(w, worksheetFormatting)),
        dashboards_list: rawDashboards.map((db: any) => mapDashboard(db, dashLayouts, data.actions ?? [])),

        stories_list: rawStories.map((s, i) => mapStory(s, i)),

        embedded_assets: embeddedAssets,
        embedded_credentials: mappedEmbeddedCreds,
        hyper_previews: mappedHyperPreviews,
        tables: rawTables.map((t: any) => ({
            datasource_id: t.datasource_id || "—",
            datasource: t.datasource || "—",
            table_name: t.table_name || "Unknown Table",
            table_id: t.table_id || "—",
            schema_name: t.schema_name || null,
            relation_type: t.relation_type || "table",
            schema_source: t.schema_source || null,
            columns: Array.isArray(t.columns) ? t.columns.map((c: any) => ({
                name: c.name || "—",
                renamed_column_name: c.renamed_column_name || null,
                datatype: c.datatype || "string"
            })) : []
        })),
        permissions: mappedPerms,
        tags: mappedTags
    }
}

export const mapParsingApiToPayload = mapParsingPayload

function createEmptyPayload(): ParsingPayload {
    return {
        workbook_name: "Unknown", version: "—", file_type: "—",
        source_build: "—", site: "—", owner: "—", last_modified: "—",
        live: 0, extract: 0, logical: 0, physical: 0, blends: 0,
        sheets: 0, dashboards: 0, stories: 0,
        dimensions: 0, measures: 0, calculated: 0, lod_total: 0, actions: 0,
        lod_fixed: 0, lod_include: 0, lod_exclude: 0,
        risks: [], sources: [], custom_sql_queries: [],
        model: { logical: [], physical: [], blends: [] },
        tables: [],
        fields: { dimensions: [], measures: [] },
        calculations: [], parameters: [], sets: [],
        worksheets: [], dashboards_list: [], stories_list: [], embedded_assets: [], embedded_credentials: [], hyper_previews: [], permissions: [], tags: []
    }
}

function classifyFields(calcsAndLods: any) {
    const dims: FieldDef[] = []
    const meas: FieldDef[] = []
    const calcFields = calcsAndLods.calculated_fields || {}

    for (const [key, val] of Object.entries(calcFields) as [string, any][]) {
        const deps = Array.isArray(val.dependencies) && val.dependencies.length > 0
            ? `deps: ${val.dependencies.join(", ")}`
            : undefined;
        const agg = val.default_aggregation
            ? `agg: ${val.default_aggregation}`
            : undefined;

        const field: FieldDef = {
            name: val.name || key || "Unknown",
            data_type: val.datatype || "string",
            source: agg || deps || "—",
            default_aggregation: val.default_aggregation || "—",
            usage_count: val.usage_count !== undefined ? val.usage_count : 0,
            formula: val.formula || "—"
        }
        if (val.type === "measure") meas.push(field)
        else if (val.type === "dimension") dims.push(field)
    }
    return { dimensions: dims, measures: meas }
}

function countPhysicalTables(dsAndConn: any): number {
    const tables: any[] = dsAndConn.logical_tables?.tables?.tables ?? []
    return tables.filter((t: any) => t.relation_type === "physical_table" || t.type === "table").length
}

function mapSource(ds: any, dsAndConn: any): DataSource {
    const conn: any = Array.isArray(ds.connections) ? (ds.connections[0] ?? {}) : {}

    const allTables: any[] = dsAndConn.logical_tables?.tables?.tables ?? []
    const standardTables = allTables
        .filter((t: any) => t.datasource === ds.name)
        .map((t: any) => t.table_name as string)

    const customSqlEntries: any[] = dsAndConn.custom_sql ?? dsAndConn.logical_tables?.custom_sql ?? dsAndConn.logical_tables?.tables?.custom_sql ?? []
    const matchingCustomSqls = customSqlEntries.filter((sql: any) => sql.datasource_id === ds.id || sql.datasource === ds.name)
    const customSqlTables = matchingCustomSqls.map((sql: any) => sql.table_name as string).filter(Boolean)

    const combinedTables = Array.from(new Set([...standardTables, ...customSqlTables]))
    return {
        id: ds.id,
        name: ds.name ?? "Unknown Source",
        type: ds.connection_type ?? conn.type ?? "Unknown",
        mode: ds.mode === "live" ? "Live" : "Extract",
        server: (conn.server && conn.server.trim() !== "") ? conn.server : "—",
        schema: conn.schema ?? conn.database ?? null,
        custom_sql: matchingCustomSqls.length > 0,
        tables: combinedTables,
        connections: Array.isArray(ds.connections) ? ds.connections : [],
    }
}

function mapRisks(data: any, stats: { live: number; calculations: CalcField[]; security: any }): RiskFlag[] {
    const risks: RiskFlag[] = []
    const { live, calculations, security } = stats

    const lodCount = calculations.filter(c => c.is_lod).length
    if (lodCount > 0) risks.push({ label: `${lodCount} LOD Expression${lodCount > 1 ? "s" : ""}`, danger: lodCount > 3 })

    const customSqlEntries: any[] = data.datasources_and_connections?.custom_sql ?? data.datasources_and_connections?.logical_tables?.custom_sql ?? data.datasources_and_connections?.logical_tables?.tables?.custom_sql ?? [];
    if (customSqlEntries.length > 0) risks.push({ label: `${customSqlEntries.length} Custom SQL Block${customSqlEntries.length > 1 ? "s" : ""}`, danger: true })

    const hasEmbedded = (data.datasources_and_connections?.datasources ?? []).some((ds: any) => (ds.embedded_credentials ?? []).length > 0)
    if (hasEmbedded) risks.push({ label: "Embedded Credentials Detected", danger: true })

    if (security.row_level_security === false) risks.push({ label: "No Row-Level Security", danger: true })
    if (live > 0) risks.push({ label: `${live} Live Connection${live > 1 ? "s" : ""}`, danger: live > 2 })

    const unusedCalcCount = Object.values(data.calculations_and_lods?.calculated_fields ?? {}).filter((c: any) => (c?.usage_count ?? 1) === 0).length
    if (unusedCalcCount > 0) risks.push({ label: `${unusedCalcCount} Unused Calculated Field${unusedCalcCount > 1 ? "s" : ""}`, danger: unusedCalcCount > 3 })

    const m2mCount = (data.datasources_and_connections?.relationships ?? []).filter((r: any) => r.cardinality === "many-to-many").length
    if (m2mCount > 0) risks.push({ label: `${m2mCount} Many-to-Many Relationship${m2mCount > 1 ? "s" : ""}`, danger: m2mCount > 1 })

    if (risks.length === 0) risks.push({ label: "Low Complexity Workbook", danger: false })

    return risks
}

function mapDataModel(dsAndConn: any): DataModel {
    const rels: any[] = dsAndConn.relationships ?? []

    const logical: LogicalRelationship[] = rels.filter((r: any) => r.relationship_type === "logical").map((r: any) => ({
        left: r.from_table ?? "—",
        right: r.to_table ?? "—",
        on: Array.isArray(r.join_conditions) ? r.join_conditions.map((c: any) => `${c.left} ${c.operator ?? "="} ${c.right}`).join(" AND ") : "—",
        type: r.relationship_type ?? "—",
        cardinality: r.cardinality ?? "—",
    }))

    const physical: PhysicalJoin[] = rels.filter((r: any) => r.relationship_type !== "logical").map((r: any) => ({
        left: r.from_table ?? "—",
        right: r.to_table ?? "—",
        join_type: r.join_type ?? r.relationship_type ?? "inner",
        condition: Array.isArray(r.join_conditions) ? r.join_conditions.map((c: any) => `${c.left} ${c.operator ?? "="} ${c.right}`).join(" AND ") : "—",
    }))

    return { logical, physical, blends: [] }
}

function mapCalculations(calcsAndLods: any): CalcField[] {
    const out: CalcField[] = []
    for (const [name, val] of Object.entries(calcsAndLods.calculated_fields ?? {}) as [string, any][]) {
        out.push({
            name: val.name ?? name,
            formula: val.formula ?? "",
            is_lod: false,
            data_type: val.datatype,
            usage_count: val.usage_count,
            source: val.default_aggregation ? `agg: ${val.default_aggregation}` : undefined,
            type: val.type,
            dependencies: val.dependencies,
        } as CalcField)
    }
    for (const [name, val] of Object.entries(calcsAndLods.lod_expressions ?? {}) as [string, any][]) {
        out.push({
            name: val.name ?? name,
            formula: val.formula ?? "",
            is_lod: true,
            data_type: val.datatype,
            usage_count: val.usage_count,
            lod_type: val.lod_type,
            source: Array.isArray(val.dependencies) && val.dependencies.length ? `deps: ${val.dependencies.join(", ")}` : undefined,
        } as CalcField)
    }
    return out
}

function mapParameters(params: any): Parameter[] {
    return Object.entries(params).map(([name, val]: [string, any]): Parameter => {
        const a = val.allowable
        let allowable = "All values"
        let allowable_list: { value: string; display_as: string }[] | undefined = undefined
        if (a?.type === "range") allowable = `Range: ${a.min ?? "?"} – ${a.max ?? "?"}` + (a.step ? ` (step: ${a.step})` : '')
        else if (a?.type === "list") {
            allowable = `List: ${(a.values ?? []).map((v: any) =>
                typeof v === 'object' ? `${v.display_as ?? v.value} (${v.value})` : String(v)
            ).join(", ")}`
            allowable_list = (a.values ?? []).map((v: any) => ({
                value: typeof v === 'object' ? String(v.value) : String(v),
                display_as: typeof v === 'object' ? String(v.display_as ?? v.value) : String(v)
            }))
        }
        return {
            id: val.id,
            name: val.name ?? name,
            data_type: val.datatype ?? "string",
            current_value: val.current_value ?? "—",
            allowable_values: allowable,
            allowable_list,
        }
    })
}

function mapSets(sets: any): SetDef[] {
    return Object.entries(sets).map(([name, val]: [string, any]): SetDef => ({
        name: val.name ?? name,
        base_field: val.base_field ?? val.field ?? "—",
        type: val.type ?? val.set_type ?? "—",
        subtype: val.subtype,
        mode: val.mode,
        count: val.count ? Number(val.count) : undefined,
        expression: val.expression,
        condition: val.expression ?? val.condition ?? "—",
        selected_members: val.selected_members ?? [],
        member_count: val.member_count,
    }))
}

function mapWorksheet(w: any, formattingList: any[]): Worksheet {
    const rows = Array.isArray(w.rows) ? w.rows : []
    const columns = Array.isArray(w.columns) ? w.columns : []
    const filters_detail = Array.isArray(w.filters) ? w.filters.map((f: any) => {
        if (typeof f === "string") return { name: f, type: "Unknown" };
        return { name: f.name || f.filter_name || "Unknown", type: f.type || "Unknown" };
    }) : [];

    const wsName = w.name || w.sheet_name || "Unknown Sheet";
    const format = formattingList.find((f: any) => f.sheet_name === wsName || f.name === wsName) || {}

    const rawColors = safeExtract(
        Array.isArray(format.colors_used) && format.colors_used.length > 0
            ? format.colors_used
            : (Array.isArray(w.colors_used) && w.colors_used.length > 0
                ? w.colors_used
                : (w.formatting?.colors || []))
    );
    const rawFonts = safeExtract(
        Array.isArray(format.fonts_used) && format.fonts_used.length > 0
            ? format.fonts_used
            : (Array.isArray(w.fonts_used) && w.fonts_used.length > 0
                ? w.fonts_used
                : (w.formatting?.fonts || []))
    );

    // Tooltip formatting: preserve structured objects with fields_used
    // Check format section first, then the sheet's own tooltip_formatting, then w.formatting
    const rawTooltips = Array.isArray(format.tooltip_formatting) && format.tooltip_formatting.length > 0
        ? format.tooltip_formatting
        : (Array.isArray(w.tooltip_formatting) && w.tooltip_formatting.length > 0
            ? w.tooltip_formatting
            : (w.formatting?.tooltip_formatting || []));
    const rawAxis = Array.isArray(format.axis_formatting) && format.axis_formatting.length > 0
        ? format.axis_formatting
        : (Array.isArray(w.axis_formatting) && w.axis_formatting.length > 0
            ? w.axis_formatting
            : (w.formatting?.axis_formatting || []));
    const rawBorders = safeExtract(
        Array.isArray(format.borders) && format.borders.length > 0
            ? format.borders
            : (Array.isArray(w.borders) && w.borders.length > 0
                ? w.borders
                : (w.formatting?.borders || []))
    );

    return {
        name: wsName,
        sheet_id: w.sheet_id ?? "",
        type: w.type ?? "worksheet",
        mark_type: w.mark_type ?? "Automatic",
        rows, columns,
        filters: filters_detail.map((f: any) => f.name),
        filters_detail,
        fields_used: rows.length + columns.length,
        actions: 0,
        colors: rawColors,
        fonts: rawFonts,
        tooltips: rawTooltips,
        axis_formatting: rawAxis,
        borders: rawBorders,
        visual_properties: w.visual_properties ?? undefined,
        marks_text: w.marks_text ?? [],
        marks_color: w.marks_color ?? [],
        marks_detail: w.marks_detail ?? [],
        marks_size: w.marks_size ?? [],
    }
}

function mapDashboard(db: any, dashboardLayouts: any, allActions: any[]): DashboardEntry {
    const dashboardName = db.dashboard_name ?? db.name ?? "Unknown Dashboard";

    let containersCount = 0;
    const rawContainersList: string[] = Array.isArray(db.containers) ? db.containers : [];
    // Exclude root containers from list and count
    const containersList: string[] = rawContainersList.filter((c: string) => !c.toLowerCase().includes('root'));
    if (containersList.length > 0) {
        containersCount = containersList.filter((c: string) => {
            const lowerC = c.toLowerCase();
            return lowerC.includes('horizontal') || lowerC.includes('vertical');
        }).length;
        // If all are horizontal/vertical, show total non-root count
        if (containersCount === 0) containersCount = containersList.length;
    }

    // Extract formatted text runs — ONLY from zone_hierarchy.Main to avoid duplicates
    // (Desktop/Tablet/Phone share the same nodes, so traversing all keys produces duplicates)
    const dashFormattedRuns: { text: string; attributes: Record<string, string> }[] = [];
    const zoneHierarchyForText = db.zone_hierarchy || {};
    const collectTextRuns = (nodeList: any[]) => {
        if (!Array.isArray(nodeList)) return;
        nodeList.forEach((node: any) => {
            if (node.formatted_text?.runs && Array.isArray(node.formatted_text.runs)) {
                node.formatted_text.runs.forEach((run: any) => {
                    const t = (run.text || '').trim();
                    if (t && t !== 'Æ' && t !== '\n' && t.length > 1) {
                        dashFormattedRuns.push({ text: t, attributes: run.attributes || {} });
                    }
                });
            }
            if (node.children && Array.isArray(node.children)) collectTextRuns(node.children);
        });
    };
    // Prefer Main key; otherwise fall back to all keys but deduplicate by text
    if (Array.isArray(zoneHierarchyForText['Main'])) {
        collectTextRuns(zoneHierarchyForText['Main']);
    } else {
        const seen = new Set<string>();
        Object.values(zoneHierarchyForText).forEach((zoneNodes: any) => {
            if (Array.isArray(zoneNodes)) collectTextRuns(zoneNodes);
        });
        // deduplicate
        const deduped = dashFormattedRuns.filter(r => { if (seen.has(r.text)) return false; seen.add(r.text); return true; });
        dashFormattedRuns.splice(0, dashFormattedRuns.length, ...deduped);
    }

    const dashboardObjects: string[] = Array.isArray(db.dashboard_objects) ? db.dashboard_objects : [];
    const deviceLayoutsList: string[] = Array.isArray(db.device_layouts) ? db.device_layouts : [];
    const layoutMode = db.layout_mode ?? db.layout ?? "Tiled";

    const actionsList = allActions
        .filter((a: any) => a.source_dashboard === dashboardName)
        .map((a: any) => ({
            name: a.name || "Unnamed Action",
            activation: a.activation || a.run_on || "—",
            type: a.type || "—"
        }));

    const parsedLayouts: Record<string, LayoutNode[]> = {};
    const devices = ['Desktop', 'Phone', 'Tablet', 'Default', 'desktop', 'phone', 'tablet'];

    const targetDbKey = Object.keys(dashboardLayouts || {}).find(k => k.toLowerCase() === dashboardName.toLowerCase());
    const layoutSource = targetDbKey ? dashboardLayouts[targetDbKey] : null;

    devices.forEach(device => {
        let rawNodes = null;
        if (db[device]) {
            rawNodes = db[device];
        } else if (db.device_layouts && !Array.isArray(db.device_layouts) && db.device_layouts[device]) {
            rawNodes = db.device_layouts[device];
        } else if (Array.isArray(db.device_layouts)) {
            const match = db.device_layouts.find((l: any) =>
                String(l.device).toLowerCase() === device.toLowerCase() ||
                String(l.name).toLowerCase() === device.toLowerCase()
            );
            if (match) rawNodes = match.layout || match.children || match.zones || match[device] || match;
        } else if (layoutSource) {
            const targetDevKey = Object.keys(layoutSource).find(k => k.toLowerCase() === device.toLowerCase());
            if (targetDevKey) rawNodes = layoutSource[targetDevKey];
        }

        if (rawNodes) {
            const flat = flattenLayouts(Array.isArray(rawNodes) ? rawNodes : [rawNodes], 0);
            if (flat.length > 0) {
                const tabName = device.charAt(0).toUpperCase() + device.slice(1).toLowerCase();
                parsedLayouts[tabName] = flat;
            }
        }
    });

    // Build device_layouts_styling from the raw per-device layout trees
    // The raw JSON stores them inside db.zone_hierarchy as Desktop/Tablet/Phone keys
    // Also check db[device] directly, db.device_layouts (if object), and dashboardLayouts
    const deviceLayoutsStyling: Record<string, any> = {};
    const deviceNames = ['Main', 'Desktop', 'Tablet', 'Phone'];
    const zoneHierarchy = db.zone_hierarchy || db.zoneHierarchy || {};

    deviceNames.forEach(device => {
        let nodes: any[] | null = null;

        // 1. Check zone_hierarchy (primary source based on user's JSON structure)
        const zhKey = Object.keys(zoneHierarchy).find(k => k.toLowerCase() === device.toLowerCase());
        if (zhKey && Array.isArray(zoneHierarchy[zhKey]) && zoneHierarchy[zhKey].length > 0) {
            nodes = zoneHierarchy[zhKey];
        }
        // 2. Check top-level db.Desktop / db.Tablet / db.Phone
        if (!nodes && db[device] && Array.isArray(db[device]) && db[device].length > 0) {
            nodes = db[device];
        }
        if (!nodes && db[device.toLowerCase()] && Array.isArray(db[device.toLowerCase()]) && db[device.toLowerCase()].length > 0) {
            nodes = db[device.toLowerCase()];
        }
        // 3. Check inside db.device_layouts object (non-array)
        if (!nodes && db.device_layouts && typeof db.device_layouts === 'object' && !Array.isArray(db.device_layouts)) {
            const dlKey = Object.keys(db.device_layouts).find((k: string) => k.toLowerCase() === device.toLowerCase());
            if (dlKey) {
                nodes = Array.isArray(db.device_layouts[dlKey]) ? db.device_layouts[dlKey] : [db.device_layouts[dlKey]];
            }
        }
        // 4. Check inside dashboardLayouts (formatting section)
        if (!nodes && layoutSource) {
            const lsKey = Object.keys(layoutSource).find((k: string) => k.toLowerCase() === device.toLowerCase());
            if (lsKey) {
                nodes = Array.isArray(layoutSource[lsKey]) ? layoutSource[lsKey] : [layoutSource[lsKey]];
            }
        }

        if (nodes && nodes.length > 0) {
            deviceLayoutsStyling[device] = nodes;
        }
    });

    return {
        name: dashboardName,
        layout: layoutMode,
        width: 0, height: 0, device_layout: "Default",
        containers: containersCount,
        containers_list: containersList,
        objects: dashboardObjects,
        device_layouts_list: deviceLayoutsList,
        device_layouts_styling: Object.keys(deviceLayoutsStyling).length > 0 ? deviceLayoutsStyling : null,
        formatted_text_runs: dashFormattedRuns,
        sheets: dashboardObjects,
        actions: actionsList.length,
        actionsList,
        layouts: parsedLayouts
    }
}

function mapStory(s: any, idx: number): Story {
    if (!s) return { name: `Story ${idx + 1}`, navigator: "—", points: [] };

    // Priority list for names: story_name > name > title > dashboard_name > index-based fallback
    const storyName = s.story_name || s.name || s.title || s.dashboard_name || `Story ${idx + 1}`;

    if (typeof s === 'string' || typeof s === 'number') {
        return {
            name: storyName,
            navigator: "Text Summary",
            points: [{ index: 1, caption: "Overview", content: String(s) }]
        };
    }

    if (typeof s === 'object') {
        const pointsArray = s.story_points || s.points || [];

        return {
            name: storyName,
            navigator: s.navigator_style || s.navigator || "—",
            points: pointsArray.map((p: any, i: number) => ({
                index: Number(p.point_number ?? p.index) || i + 1,
                caption: p.caption || p.name || `Point ${i + 1}`,
                content: p.source_content || p.content || p.worksheet || p.description || String(p) || "—",
            })),
        }
    }

    return { name: storyName, navigator: "Unknown", points: [] };
}

interface ParsingStore {
    parsingRaw: Record<string, any>;
    parsingData: Record<string, ParsingPayload>;
    isLoading: Record<string, boolean>;
    error: Record<string, string | null>;

    fetchParsingResult: (projectId: string, workbookId: string, runId: string) => Promise<void>;
    triggerParsing: (projectId: string, workbookIds: string[], userEmail: string, runId: string) => Promise<void>;
    reset: () => void;
}

export const useParsingStore = create<ParsingStore>((set, get) => ({
    parsingRaw: {},
    parsingData: {},
    isLoading: {},
    error: {},

    fetchParsingResult: async (projectId, workbookId, runId) => {
        if (!get().parsingData[workbookId]) {
            set((state) => ({
                isLoading: { ...state.isLoading, [workbookId]: true },
                error: { ...state.error, [workbookId]: null }
            }));
        }

        try {
            const result = await parsingService.getWorkbookResult(projectId, workbookId, runId);

            if (JSON.stringify(get().parsingRaw[workbookId]) === JSON.stringify(result)) {
                return;
            }

            if (result && result.detail && result.detail.toLowerCase().includes("not found")) {
                set((state) => ({ error: { ...state.error, [workbookId]: null } }));
                return;
            }

            set((state) => ({ parsingRaw: { ...state.parsingRaw, [workbookId]: result } }));

            if (result) {
                const mapped = mapParsingPayload(result);
                set((state) => ({
                    parsingData: { ...state.parsingData, [workbookId]: mapped },
                    error: { ...state.error, [workbookId]: null }
                }));
            }
        } catch (err: any) {
            if (err.message?.includes("404") || err.message?.toLowerCase().includes("not found")) {
                console.warn(`[ParsingStore] Waiting for parsing data for ${workbookId}...`);
                set((state) => ({ error: { ...state.error, [workbookId]: null } }));
            } else {
                set((state) => ({ error: { ...state.error, [workbookId]: err.message || "Failed to fetch parsing results" } }));
            }
        } finally {
            set((state) => ({ isLoading: { ...state.isLoading, [workbookId]: false } }));
        }
    },

    triggerParsing: async (projectId, workbookIds, userEmail, runId) => {
        try {
            // Build the items array matching what the API route expects
            const items = workbookIds.map(id => ({
                project_id: projectId,
                workbook_id: id,
            }));

            const response = await fetchWithAuth('/api/parsing', {
                method: 'POST',
                body: JSON.stringify({
                    user_email: userEmail,
                    run_id: runId,
                    items,
                })
            });

            console.log("[ParsingStore] Parsing job triggered successfully for", workbookIds.length, "workbook(s).");
            return response;
        } catch (err: any) {
            // ★ Silently handle 404 (backend endpoint not available yet) and other non-critical errors
            if (err.message?.includes("404") || err.message?.toLowerCase().includes("not found")) {
                console.warn("[ParsingStore] Parsing endpoint not available yet (404) — parsing may be handled by backend automatically.");
            } else {
                console.warn("[ParsingStore] Failed to trigger parsing (non-critical):", err.message);
            }
        }
    },

    reset: () => set({ parsingRaw: {}, parsingData: {}, isLoading: {}, error: {} })
}))