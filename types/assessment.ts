export interface QlikApp {
  id: string;
  name: string;
}

export interface AssessmentData {
  report_name: string;
  results: AssessmentResultItem[];
  status: string;
  folder_name?: string;
  sharepoint_upload?: { message: string; status: string };
  upload_messages?: string[];
}

export interface AssessmentResultItem {
  category: string;
  value: string | number | { [key: string]: unknown };
}

export interface ParsedData {
  files: string[];
  autogen_summary: string;
  dimensions: { dimension_count: number; dimensions: unknown[] };
  errors: string[];
  filters: { filter_pane_count: number; filter_panes: unknown[] };
  folder: string;
  measures: { measure_count: number; measures: unknown[] };
  script: {
    datasources: unknown[];
    datasources_results: unknown[];
    filename: string;
    table_column_renames: unknown[];
    tables: unknown[];
  };
  report_type?: string;
  structure?: {
    data_model?: string;
  };
}

export interface MappedData {
  file_data: {
    file_name: string;
    database_name: string;
    database_platform: string;
  };
  mapping_report: {
    file_name: string;
    mapped_fields: number;
    mapped_percentage: number;
    total_fields: number;
    total_tables: number;
    table_mappings: unknown[];
    unmapped_fields: unknown[];
  };
  dax_measures_report: { measures: unknown[]; total_measures: number };
  dimensions_report: { dimensions: unknown[]; total_dimensions: number };
  relationships_report: { relationships: unknown[]; total_relationships: number };
  status: string;
}

export interface ReportGenerationData {
  report_id: string;
  status: string;
  output: {
    file_name: string;
    format: string;
    generated_at: string;
    content_summary: string;
  };
}

export interface DateTimeFormat {
  formattedDate: string;
  formattedTime: string;
}

export interface ProcessStatus {
  assessment: { status: "pending" | "running" | "completed" | "failed"; result?: AssessmentData; error?: string };
  parsing: {
    status: "pending" | "running" | "completed" | "failed";
    result?: ParsedData | null;
    error?: string;
    step?: number;
  };
  mapping: {
    status: "pending" | "running" | "completed" | "failed";
    result?: MappedData | null;
    error?: string;
    step?: number;
  };
  reportGeneration: {
    status: "pending" | "running" | "completed" | "failed";
    result?: ReportGenerationData | null | undefined;
    error?: string;
  };
  validation: {
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    result?: any;
    error?: string;
  };
}

export interface AppProcessState {
  [appId: string]: ProcessStatus;
}
