# Qlik Integration

## Overview
Similar to Tableau, Qlik Sense is supported as a secondary BI extraction source.

> [!WARNING]
> **Implementation Boundary:** The Next.js BFF only proxies Qlik requests. The actual app discovery, object metadata extraction, and dimension/measure extraction are handled by an external Qlik Python service (`process.env.QLIK_URL`).

## Qlik Flow
1. **Authentication:** Authenticated via the BFF to the Qlik external backend.
2. **Discovery:** The frontend utilizes `app/api/qlik/spaces` to query available workspaces and `app/api/qlik/apps` to retrieve available Qlik Apps.
3. **Extraction:** The Qlik Python backend uses the Qlik Engine API (often via WebSockets) to extract sheet objects, master items, and load scripts, passing this data into the Semantic Kernel AI pipeline.
