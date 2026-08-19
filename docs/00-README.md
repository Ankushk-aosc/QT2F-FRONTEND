# SaaS Migration Platform Documentation

## Purpose
This repository contains the Next.js Frontend and Backend-For-Frontend (BFF) layers for an enterprise-grade migration platform. The platform manages the migration of BI assets (Tableau and Qlik) into Microsoft Fabric.

> [!WARNING]
> **Repository Boundary:** This repository *only* contains the Next.js Web Application and API routing layers. The core Python backend services, Semantic Kernel AI orchestration, and automated extraction engines are external microservices connected via HTTP.

## Architecture
The system operates as a **Backend-For-Frontend (BFF)** architecture:
1. **Frontend:** React 19 / Next.js 15, managed via Zustand, styled with Microsoft Fluent UI.
2. **BFF (This Repo):** Next.js API Routes (`/api/*`) that handle authentication, inject tokens, and proxy requests to backend services.
3. **Backend Services (External):** Python-based microservices managing Tableau/Qlik extraction, Semantic Kernel (AI Agents), and Microsoft Fabric target deployment.

## Documentation Index

### Overview & Structure
- [01-system-overview.md](01-system-overview.md)
- [02-architecture.md](02-architecture.md)
- [03-repository-structure.md](03-repository-structure.md)

### Core Application & APIs
- [04-frontend-architecture.md](04-frontend-architecture.md)
- [05-backend-architecture.md](05-backend-architecture.md)
- [06-authentication-authorization.md](06-authentication-authorization.md)
- [07-api-architecture.md](07-api-architecture.md)
- [08-api-endpoints.md](08-api-endpoints.md)
- [09-data-flow.md](09-data-flow.md)

### Integrations & AI
- [10-database-and-storage.md](10-database-and-storage.md)
- [11-tableau-integration.md](11-tableau-integration.md)
- [12-qlik-integration.md](12-qlik-integration.md)
- [13-microsoft-fabric-integration.md](13-microsoft-fabric-integration.md)
- [14-ai-architecture.md](14-ai-architecture.md)
- [15-semantic-kernel.md](15-semantic-kernel.md)
- [16-ai-agents.md](16-ai-agents.md)
- [17-agent-01-assessment.md](17-agent-01-assessment.md)
- [18-agent-02-parsing.md](18-agent-02-parsing.md)
- [19-agent-03-mapping.md](19-agent-03-mapping.md)
- [20-agent-04-data-layer.md](20-agent-04-data-layer.md)
- [21-agent-05-generation.md](21-agent-05-generation.md)
- [22-agent-06-validation.md](22-agent-06-validation.md)
- [23-migration-workflow.md](23-migration-workflow.md)

### Operations & Analysis
- [24-monitoring-and-logging.md](24-monitoring-and-logging.md)
- [25-state-management.md](25-state-management.md)
- [26-error-handling.md](26-error-handling.md)
- [27-security.md](27-security.md)
- [28-configuration.md](28-configuration.md)
- [29-environment-variables.md](29-environment-variables.md)
- [30-dependencies.md](30-dependencies.md)
- [31-deployment.md](31-deployment.md)
- [32-ci-cd.md](32-ci-cd.md)
- [33-testing.md](33-testing.md)
- [34-troubleshooting.md](34-troubleshooting.md)
- [35-performance.md](35-performance.md)
- [36-known-issues.md](36-known-issues.md)
- [37-technical-debt.md](37-technical-debt.md)
- [38-code-to-architecture-mapping.md](38-code-to-architecture-mapping.md)
- [39-end-to-end-execution-traces.md](39-end-to-end-execution-traces.md)
- [40-implementation-vs-documentation.md](40-implementation-vs-documentation.md)

## Developer Onboarding

### Setup
1. Clone the repository.
2. Run `npm install` (using Node.js 20+).
3. Copy `.env.example` to `.env.local` and populate the required Microsoft Entra ID (MSAL) and API URLs.
4. Run `npm run dev` to start the local development server.

### Important Warnings
- **Authentication**: Do not bypass `fetchWithAuth.ts`. It handles token injection dynamically.
- **State Management**: Zustand stores (e.g., `agent.store.ts`) are currently monolithic and handle complex polling logic. Edit with caution to avoid re-render loops.
- **Error Handling**: Never return raw `err.stack` traces in API responses, as this is a security risk.
