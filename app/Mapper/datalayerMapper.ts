// app/Mapper/datalayerMapper.ts

export interface DataLayerResultMapped {
  id: string
  status: string
  created_at: string
  project_id: string
  workbook_id: string
  run_id: string
  processing_summary: any[]
  lakehouse?: {
    id: string
    name: string
    sql_connection_string: string
  }
  notebooks?: {
    count: number
    silver: string
    gold: string
  }
  pipeline_summary?: {
    hyper_files_found: number
    parquet_files_created: number
    bronze_tables_created: number
    silver_tables_created: number
    gold_tables_created: number
    gold_delta_tables?: number
    notebooks_created: number
  }
  extract_pipeline?: {
    hyper_files: string[]
    parquet_files: string[]
    bronze_tables: string[]
    silver_tables_processing: string
    gold_tables_processing: string
  }
  processing_mode?: string
  workspace_tier?: string
}

export function mapDataLayerResponse(raw: any): DataLayerResultMapped {
  if (!raw) return {} as any

  const payload = raw.payload || {}
  const summary = payload.processing_summary?.[0] || {}

  return {
    id: raw.id || '',
    status: raw.status || 'unknown',
    created_at: raw.created_at || '',
    project_id: raw.project_id || payload.project_id || '',
    workbook_id: raw.workbook_id || (payload.workbook_ids ? payload.workbook_ids[0] : ''),
    run_id: raw.run_id || payload.run_id || '',
    processing_summary: payload.processing_summary || [],
    lakehouse: summary.fabric_artifacts?.lakehouse,
    notebooks: {
      count: summary.fabric_artifacts?.notebooks?.count || 0,
      silver: summary.fabric_artifacts?.notebooks?.created?.silver || '',
      gold: summary.fabric_artifacts?.notebooks?.created?.gold || '',
    },
    pipeline_summary: summary.pipeline_summary,
    extract_pipeline: summary.extract_pipeline,
    processing_mode: summary.processing_mode || payload.processing_mode || '',
    workspace_tier: summary.workspace_tier || payload.workspace_tier || '',
  }
}
