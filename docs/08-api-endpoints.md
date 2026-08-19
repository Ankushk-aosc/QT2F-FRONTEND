# API Endpoints

This document catalogs the primary API endpoints exposed by the Next.js Backend-For-Frontend (BFF) inside the `app/api/*` directory. 

These endpoints are called by the React frontend and subsequently proxy the requests to external Python services.

## Authentication Endpoints (`/api/auth/*`)

### `GET /api/auth/config`
- **Purpose:** Returns the Microsoft Entra ID (MSAL) configuration to the frontend (ClientId, Authority, Redirect URIs).
- **Authentication:** Public
- **Downstream:** None (Reads from `.env.local`)

### `GET /api/auth/seed-rt`
- **Purpose:** Performs a one-time server-side confidential auth-code flow to seed a Refresh Token into the Python backend for long-running Semantic Kernel jobs.
- **Authentication:** MSAL Session Cookie
- **Downstream:** Azure AD Token endpoint

## Migration Endpoints (`/api/migration/*`)

### `POST /api/migration/process-site`
- **Purpose:** Triggers the beginning of the Semantic Kernel 6-Agent migration pipeline.
- **Authentication:** Bearer token (MSAL)
- **Request:** `{ workbook_id: string, destination: object }`
- **Response:** `{ run_id: string }`
- **Downstream:** Semantic Kernel Backend (`apiType: "semantic"`)

### `GET /api/migration/data-layer`
- **Purpose:** Retrieves the current telemetry/log status for the Data Layer agent.
- **Authentication:** Bearer token
- **Request Parameters:** `?project_id=...&workbook_id=...&run_id=...`
- **Downstream:** Logs API Backend (`apiType: "logs"`)

*(Note: There are identical `GET` and `POST` routes for `/parsing`, `/mapping`, `/generation`, and `/validation` mirroring the `data-layer` pattern).*

### `GET /api/migration/status`
- **Purpose:** Retrieves the overall pipeline status for a specific `run_id`.
- **Authentication:** Bearer token
- **Downstream:** Logs API Backend

## Tableau Integration Endpoints (`/api/tableau/*`)

### `POST /api/tableau/connections`
- **Purpose:** Connects to a Tableau site using a Personal Access Token (PAT).
- **Authentication:** Bearer token
- **Request:** `{ serverUrl, siteName, patName, patSecret }`
- **Downstream:** Tableau Extractor API (`apiType: "tableau"`)

### `GET /api/tableau/server-projects`
- **Purpose:** Retrieves a list of all Tableau Projects available on the connected site.
- **Authentication:** Bearer token
- **Downstream:** Tableau Extractor API

### `GET /api/tableau/workbooks`
- **Purpose:** Retrieves workbooks inside a selected project.
- **Authentication:** Bearer token
- **Downstream:** Tableau Extractor API

## Qlik Integration Endpoints (`/api/qlik/*`)

### `GET /api/qlik/spaces`
- **Purpose:** Retrieves available Qlik spaces (workspaces).
- **Authentication:** Bearer token
- **Downstream:** Qlik API Backend (`apiType: "qlik"`)

### `GET /api/qlik/apps`
- **Purpose:** Retrieves Qlik Apps inside a specified space.
- **Authentication:** Bearer token
- **Downstream:** Qlik API Backend

## Error Handling standard
If any of these APIs fail to connect to the downstream python services, they utilize `errorResponse()` in `httpClient.ts`. Currently, this leaks the downstream `err.stack` in the JSON response payload.
