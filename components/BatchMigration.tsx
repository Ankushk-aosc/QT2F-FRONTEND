// components/BatchMigration.tsx

"use client"

import { migrationService } from '@/services/migration.service'
import { useAgentStore, mapAssessmentResponseToStore } from '@/stores/agent.store'

export default function BatchMigration() {
  const { setAssessmentData, setCurrentRunId, getAssessmentByItem } = useAgentStore()

  const handleBatchMigration = async () => {
    const items = [
      {
        project_id: "82e28264-8d0a-4fa9-8f57-9aa96a61389c",
        workbook_id: "f6c7f672-43f3-490c-9e18-2d1aff4870a7"
      },
      {
        project_id: "82e28264-8d0a-4fa9-8f57-9aa96a61389c",
        workbook_id: "9cd651cb-bc5c-4b86-8d3a-7ccca0932ddc"
      }
    ]

    try {
      const { run_id } = await migrationService.invokeBatch(items, "shobit@example.com")
      setCurrentRunId(run_id)
    } catch (error) {
      console.error('Batch migration failed:', error)
    }
  }

  const assessmentData = getAssessmentByItem(
    "82e28264-8d0a-4fa9-8f57-9aa96a61389c",
    "9cd651cb-bc5c-4b86-8d3a-7ccca0932ddc"
  )

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Batch Migration</h2>
      <button 
        onClick={handleBatchMigration}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Start Migration
      </button>
      
      {assessmentData && (
        <div className="mt-4 p-4 border rounded">
          <h3 className="font-semibold mb-2">Assessment Results</h3>
          <p>Status: {assessmentData.status}</p>
          <p>Workbook: {assessmentData.workbook_name}</p>
          <p>Connection Type: {assessmentData.connection_type}</p>
        </div>
      )}
    </div>
  )
}