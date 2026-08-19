# System Overview

## Business Purpose
The unified SaaS application is designed to automate and manage the migration of legacy Business Intelligence (BI) assets—specifically Tableau Workbooks and Qlik Apps—into Microsoft Fabric and PowerBI. 

By leveraging an AI-driven 6-agent pipeline powered by Semantic Kernel, the platform aims to reduce the manual effort required to translate complex calculations (e.g., Tableau LOD expressions, Qlik SET Analysis) into Microsoft Fabric architectures (Lakehouses, DAX Semantic Models).

## Main User Journey
1. **Login:** User authenticates via Microsoft Entra ID (Azure AD).
2. **Connect Source:** User provides connection details for their Tableau Server/Cloud or Qlik Sense environment.
3. **Select Assets:** The platform retrieves available Workbooks/Apps. The user selects which ones to migrate.
4. **Execute Migration:** The user triggers the migration.
5. **Monitor Progress:** The user watches a real-time dashboard tracking the 6-agent AI pipeline (Assessment → Parsing → Mapping → Data Layer → Generation → Validation).
6. **Review Results:** The user reviews the mapped DAX calculations, schema generation status, and row-level data validation results between the source and target.

## Major Features
- **MSAL Authentication:** Enterprise-grade security utilizing Microsoft Entra ID.
- **Real-Time Telemetry Polling:** A highly responsive dashboard displaying live AI agent logs.
- **Multi-Source Support:** Integrations for both Tableau and Qlik within a unified interface.
- **Result Visualization:** Deep, horizontal tabbed views showing structural breakdown (Data Sources, Relationships, Measures).

## Main Technologies
- **Frontend Framework:** Next.js 15 (App Router)
- **UI Library:** Microsoft Fluent UI v9
- **State Management:** Zustand
- **Language:** TypeScript
- **Authentication:** `@azure/msal-browser` and `@azure/msal-react`
- **Testing:** Vitest

## External Dependencies (Services)
The Next.js application acts as a Backend-For-Frontend (BFF) to the following external dependencies:
1. **Semantic Kernel / Agent API:** The Python-based AI orchestration engine executing the 6-agent pipeline.
2. **Tableau/Qlik APIs:** Python microservices that execute the heavy extraction workloads against BI sources.
3. **Logs API:** A high-throughput telemetry service feeding real-time migration logs.

## Main Data Flow
1. **User Action:** The user clicks "Start Migration" in the React frontend.
2. **API Proxy:** The frontend (`fetchWithAuth.ts`) sends a request to the Next.js BFF (`/api/migration/process-site`).
3. **Service Dispatch:** The BFF authenticates the request and uses `httpClient.ts` to dispatch it to the external Python Semantic Kernel service.
4. **Background Execution:** The Python service spins up the agent pipeline asynchronously.
5. **Polling Feedback:** The React frontend polls the `logs` backend to stream state updates into the Zustand `agent.store.ts`, rendering the updates live in the `MonitoringTab.tsx`.
