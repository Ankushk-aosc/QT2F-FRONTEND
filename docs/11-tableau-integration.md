# Tableau Integration

## Overview
Tableau Integration acts as the primary data extraction source. The Next.js BFF exposes routes to connect to Tableau Server and Tableau Cloud.

> [!WARNING]
> **Implementation Boundary:** The Next.js BFF only proxies Tableau connection credentials. The actual XML extraction, Workbook downloading, and metadata parsing is done by an external Python service (`process.env.TABLEAU_API_URL`).

## Tableau Flow
1. **Authentication:** The user provides the Server URL, Site Name, PAT Name, and PAT Secret in the `MigrationTab.tsx` UI.
2. **API Proxy:** The frontend calls `/api/tableau/connections`.
3. **Backend Hand-off:** The BFF forwards this to the external Tableau API.
4. **Metadata Discovery:** The frontend then queries `/api/tableau/server-projects` and `/api/tableau/workbooks`. The external backend translates these into native Tableau Server REST API calls, returning a structured list to the UI.
5. **Extraction:** When a migration begins, the external backend uses the Tableau REST API to download the `.twb`/`.twbx` files, unzips them, and feeds the raw XML into the Semantic Kernel AI pipeline.
