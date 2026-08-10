// services/datalayer.service.ts
import { fetchWithAuth } from '@/lib/fetchWithAuth'

export const datalayerService = {
  fetchDataLayer: async (projectId: string, workbookId: string, runId: string) => {
    const params = new URLSearchParams({
      project_id: projectId,
      workbook_id: workbookId,
      run_id: runId
    })
    
    // Using workspace_id if available in context, otherwise it might be optional for the GET record
    // In the user's example: .../api/records/data-layer?run_id=...&project_id=...&workbook_id=...&workspace_id=...
    // We'll use the record-fetching endpoint pattern which usually uses project/workbook/run
    return await fetchWithAuth<any>(`/api/datalayer?${params.toString()}`)
  }
}
