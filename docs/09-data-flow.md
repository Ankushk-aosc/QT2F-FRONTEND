# End-to-End Data Flow

This document traces the actual data flow of the primary operation in the application: **Triggering a Migration**.

## The Migration Trigger Flow

When a user selects a Tableau workbook and clicks "Start Migration", the following sequential flow occurs across the tiers:

### 1. UI Interaction
- **File:** `components/tabs/MigrationTab.tsx`
- **Action:** User clicks the `Start Migration` button.
- **Event Handler:** The `onSubmit()` or `handleMigration()` function gathers the selected `workbook_id`, `project_id`, and destination configurations from the React local state.

### 2. Frontend State Update
- **File:** `stores/agent.store.ts`
- **Action:** The component calls `setMigrationStarted(true)`. The UI switches from the Migration Tab to the Monitoring Tab.

### 3. API Request (Frontend)
- **File:** `components/tabs/MigrationTab.tsx` (or extracted service)
- **Action:** The frontend executes a `POST` request to `/api/migration/process-site`.
- **Interception:** Before the request leaves the browser, `lib/fetchWithAuth.ts` intercepts it.
  - It requests an MSAL token via `getActiveToken()` (from `MsalProviderWrapper.tsx`).
  - It injects `Authorization: Bearer <token>` into the request headers.

### 4. Next.js API Route (BFF)
- **File:** `app/api/migration/process-site/route.ts`
- **Action:** The Next.js server receives the POST request.
- **Parsing:** It extracts the `body`. It validates that `workbook_id` exists. It may apply default business logic (e.g., if `source_type` is undefined, default to `"cloud"`).
- **Forwarding:** It calls `httpPost("semantic", "/tableau/process-site", body)`.

### 5. HTTP Client (BFF)
- **File:** `lib/api/httpClient.ts`
- **Action:** 
  - Extracts the `"authorization"` header from the incoming Next.js request (`headers()`).
  - Resolves `apiType: "semantic"` to `process.env.SEMANTIC_KERNEL_URL`.
  - Executes a `node-fetch` style request to the Python backend.

### 6. External Microservice Execution (Semantic Kernel)
- **Location:** *External Python Service (Not in this repository)*
- **Action:** The Semantic Kernel API receives the request, validates the token, generates a unique `run_id`, and spawns a background thread/job to begin the AI Agent workflow (Assessment → Parsing).
- **Response:** It immediately returns a 200 OK containing the `{ run_id }` back to the Next.js API.

### 7. UI Response & Polling
- **File:** `app/api/migration/process-site/route.ts` 
  - Returns the `run_id` back to the browser.
- **File:** `stores/agent.store.ts`
  - Saves the `run_id` (`setCurrentRunId(run_id)`).
  - Triggers a `setInterval` loop that constantly fetches `/api/activities` and `/api/monitoring-logs` to stream the background agent progress to the user.
