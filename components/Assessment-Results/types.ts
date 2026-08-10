export interface AssessmentResultItem {
  category: string;
  value: string | number | {
    details?: string[];
    recommendation?: string;
    priority?: string;
    quality?: string;
    model_type?: string;
    stats?: string;
    structure?: string;
    level?: string;
    count?: number;
    screenshots?: Array<{
      title?: string;
      visualization_type?: string;
      story?: string;
      creation_date?: string;
      annotation?: string;
      position?: string | { width: string; height: string; top: string; left: string; 'z-index'?: number; right?: string };
    }>;
    status?: string;
    [key: string]: unknown;
  };
}

export interface AssessmentData {
  report_name: string;
  results: AssessmentResultItem[];
  status: string;
  message?: string;
  sharepoint_upload?: {
    json?: { json_download_url?: string; message?: string; status?: string };
    pdf?: { pdf_download_url?: string; message?: string; status?: string };
  };
  upload_messages?: string[];
  folder_name?: string;
}

export interface MappedAssessmentData {
  appName?: string;
  report_name: string;
  file_type: string;
  KPI: number;
  page_count: number;
  database_name: string;
  complexity: string;
  business_criticality: string;
  documentation_quality: string;
  dimensional_model: string;
  data_sensitivity: string;
  data_volume: string;
  migration_challenges: string;
  query_complexity: string;
  unsupported_data_types: string;
  powerbi_replicability: {
    details: string[];
    recommendation: string;
  };
  screenshots: string;
  data_model: string;
  datasets: { name: string; fields: number; keys: number }[];
  assessments: {
    complexity: string[];
    powerbi: string[];
    criticality: string[];
    documentation: string[];
    dimensional: string[];
    sensitivity: string[];
    data_volume: string[];
    migration_challenges: string[];
    query_complexity: string[];
    unsupported_data_types: string[];
    screenshots: string[];
    KPI: string[];
    page_count: string[];
    data_model: string[];
  };
  sharepoint_upload?: {
    json?: { json_download_url?: string; message?: string; status?: string };
    pdf?: { pdf_download_url?: string; message?: string; status?: string };
  };
  upload_messages?: string[];
}