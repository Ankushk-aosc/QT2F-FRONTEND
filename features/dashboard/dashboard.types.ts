export interface MigrationConfig {
  siteUrl: string
  projectName: string
  workbookName: string
  targetFabricWorkspace?: string
}

export interface AgentStatus {
  name: string
  status: "pending" | "running" | "completed" | "failed"
  startTime?: Date
  endTime?: Date
  progress?: number
}

export interface MigrationRun {
  id: string
  config: MigrationConfig
  status: "pending" | "running" | "completed" | "failed"
  startTime: Date
  endTime?: Date
  agents: AgentStatus[]
  results?: MigrationResults
  logs: LogEntry[]
}

export interface LogEntry {
  timestamp: Date
  level: "info" | "warn" | "error" | "success"
  agent: string
  message: string
}

export interface MigrationResults {
  assessment: AssessmentResults
  parsing: ParsingResults
  mapping: MappingResults
  dataLayer: DataLayerResults
  generation: GenerationResults
  validation: ValidationResults
}

export interface AssessmentResults {
  totalWorkbooks: number
  dashboards: number
  calculatedFields: number
  lodExpressions: number
  dataSources: DataSourceType[]
  extractsInfo: ExtractsInfo
  complexityAnalysis: ComplexityAnalysis
  estimatedEffort: EstimatedEffort
}

export interface DataSourceType {
  name: string
  type: string
}

export interface ExtractsInfo {
  count: number
  totalSize: string
  parameters: number
}

export interface ComplexityAnalysis {
  level: "low" | "medium" | "high"
  score: number
  factors: string[]
}

export interface EstimatedEffort {
  hours: number
  confidence: number
}

export interface ParsingResults {
  workbooksProcessed: number
  calculationsExtracted: number
  relationshipsIdentified: number
  datasourcesAnalyzed: number
  errors: number
}

export interface MappingResults {
  totalMappings: number
  directMappings: number
  customMappings: number
  unmappedFunctions: number
  conversionRules: ConversionRule[]
}

export interface ConversionRule {
  from: string
  to: string
  type: string
  confidence: number
}

export interface DataLayerResults {
  modelsGenerated: number
  relationshipsCreated: number
  measuresCreated: number
  tablesCreated: number
  dataflowsCreated: number
}

export interface GenerationResults {
  reportsGenerated: number
  dashboardsCreated: number
  visualsCreated: number
  pagesCreated: number
  status: "success" | "partial" | "failed"
}

export interface ValidationResults {
  totalChecks: number
  passed: number
  failed: number
  warnings: number
  issues: ValidationIssue[]
  dataAccuracy: number
  visualAccuracy: number
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info"
  component: string
  message: string
  suggestion?: string
}

export interface DashboardStats {
  totalSelected: number
  running: number
  success: number
  failed: number
  selectedApplications: SelectedApplication[]
}

export interface SelectedApplication {
  name: string
  status: "pending" | "running" | "mapping" | "completed" | "failed"
  progress?: number
}
