# Complete Migration Workflow

Trace of a full migration execution based on the UI implementation.

```text
User 
  ↓ (Clicks "Start Migration" in `MigrationTab.tsx`)
`startMigration()` function triggered
  ↓
`fetchWithAuth()` executes POST to `/api/migration/process-site`
  ↓
Next.js BFF (`route.ts`) receives payload
  ↓
`httpClient.post("semantic", "/tableau/process-site", ...)`
  ↓
External Python Semantic Kernel backend receives request, generates `run_id`
  ↓
Backend spins up Agent 1 (Assessment) asynchronously.
  ↓
Backend returns `run_id` immediately (HTTP 200) to Next.js BFF.
  ↓
BFF returns `run_id` to React UI.
  ↓
React UI saves `run_id` to `agent.store.ts` (`setCurrentRunId`).
  ↓
React UI switches to `MonitoringTab.tsx`.
  ↓
`agent.store.ts` begins `setInterval` polling every few seconds.
  ↓
React UI calls `/api/monitoring-logs` via BFF.
  ↓
BFF calls Python `logs` API.
  ↓
Logs return real-time updates: `{"agent_name": "Agent 2", "status": "IN_PROGRESS"}`
  ↓
Zustand updates, progress bars animate.
  ↓
(Background) Semantic Kernel completes Agents 1-6 in sequence.
  ↓
Logs return: `{"agent_name": "Agent 6", "status": "COMPLETED"}`
  ↓
Zustand stops polling.
  ↓
UI displays the `ResultTab.tsx`.
```
