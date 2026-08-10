import { MappingPayload } from "@/stores/mapping.store";

export function mapMappingPayload(rawDoc: any): MappingPayload {
    if (!rawDoc) return createEmptyPayload();

    // If the Cosmos DB API returns an array of records, we need to unwrap it
    const document = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
    const data = document.payload || document.data || document;

    // Tables
    const tables = data.tables || data.Tables || [];

    // Calculates & LODs
    const lods = data.lods || data.mapped_lods || data.calculated_fields || data.lod_expressions || [];

    // Parameters
    const parameters = data.parameters || data.mapped_parameters || data.Parameters || [];

    // Sets
    const sets = data.sets || data.mapped_sets || data.Sets || [];

    // Visuals
    const visuals = data.visuals?.sheet_visuals || data.visuals || data.mapped_visuals || data.worksheets || data.Visuals || [];

    // Custom SQL
    const custom_sql = data.custom_sql || data.mapped_custom_sql || data.CustomSQL || [];

    // Datasources
    const datasources = data.datasources || data.sources || data.Datasources || [];

    // Relationships
    let relationships = data.relationships || data.Relationships || [];
    if (relationships.length === 0 && data.datasources_and_connections) {
        if (Array.isArray(data.datasources_and_connections)) {
            data.datasources_and_connections.forEach((conn: any) => {
                if (conn.relationships && Array.isArray(conn.relationships)) {
                    relationships.push(...conn.relationships);
                }
            });
        } else if (data.datasources_and_connections.relationships) {
            relationships = data.datasources_and_connections.relationships;
        }
    }

    // Mapping table (for Summary)
    const mapping_table = data.mapping_table || data.mapped_elements || [];

    return {
        workbook_name: data.workbook_name || rawDoc.workbook_name || data.project_name || "Unknown Workbook",
        tables,
        lods,
        parameters,
        sets,
        visuals,
        custom_sql,
        datasources,
        relationships,
        mapping_table,
        dashboard_layouts: data.dashboard_layouts || {},
        ...data // Expose raw data for tabs to consume directly
    };
}

function createEmptyPayload(): MappingPayload {
    return {
        workbook_name: "Unknown",
        tables: [],
        lods: [],
        parameters: [],
        sets: [],
        visuals: [],
        custom_sql: [],
        datasources: [],
        relationships: [],
        mapping_table: []
    };
}
