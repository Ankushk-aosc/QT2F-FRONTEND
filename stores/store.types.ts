// stores/store.types.ts
// Updated with projectId in Application

// Core type definitions for the application state

export type AgentType = "Assessment" | "Parsing" | "Mapping" | "Data Layer" | "Generation" | "Validation" | "Health Check" | "System" | "Initialization" | "Batch Invoke"

export type AppStatus = "Idle" | "Running" | "Success" | "Failed"

// `TableauConfig` was removed here. It described a Tableau credential —
// including a bare `tokenValue` — as a client state shape, and the store that
// held it is gone. Tableau credentials live in the migration backend's Key
// Vault and are referenced from the browser only by `connection_id`; keeping a
// type that models the secret invites somebody to populate it again.

export interface Application {
  id: string
  workbookId: string
  siteName: string
  projectName: string
  projectId: string
  workbookName: string
  status: AppStatus
  currentAgent: AgentType | null
  startTime: Date
  endTime?: Date
  final_status?: string
}

export interface LogEntry {
  id: string
  timestamp: Date
  siteName: string
  workbookName: string
  agent: AgentType
  message: string
  severity: "Info" | "Running" | "Error" | "Success" | "Warning"
}

export interface AgentResult {
  assessment?: AssessmentResult
  parsing?: ParsingResult
  mapping?: MappingResult
  dataLayer?: DataLayerResult
  generation?: GenerationResult
  validation?: ValidationResult
}

export interface AssessmentResult {
  totalWorkbooks: number
  totalDatasources: number
  complexityScore: number
  estimatedHours: number
  riskFactors: string[]
  inventory: {
    sites: number
    projects: number
    dashboards: number
  }
}

export interface ParsingResult {
  datasources: number
  calculatedFields: number
  lodExpressions: number
  parameters: number
  sheets: number
  dashboards: number
  extractedMetadata: Record<string, any>
}

export interface MappingResult {
  mappedCalculatedFields: number
  mappedParameters: number
  mappedVisuals: number
  mappedDataSources: number
  daxMeasures: number
  conversionRate: number
}

export interface DataLayerResult {
  migratedTables: number
  deltaTablesCreated: number
  totalDataSize: string
  connectionType: string
  lakehouses: string[]
}

export interface GenerationResult {
  semanticModelsCreated: number
  reportPagesCreated: number
  visualsGenerated: number
  tmdlFilesCreated: number
  pbixGenerated: boolean
}

export interface ValidationResult {
  rowCountMatch: boolean
  aggregateAccuracy: number
  visualFidelityScore: number
  passedChecks: number
  totalChecks: number
  issues: string[]
}

export interface RunHistoryItem {
  id: string
  runDate: Date
  siteName: string
  projectName: string
  applications: Application[]
  overallStatus: "Success" | "Partial" | "Failed"
}