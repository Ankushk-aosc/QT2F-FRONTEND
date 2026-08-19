# Repository Structure

## Overview
This repository contains a standard Next.js App Router structure, heavily relying on React Server Components (where applicable) and Client Components for interactive elements.

## Core Directories

### `app/`
- **Purpose:** Next.js 15 App Router directory. Defines the application routing, pages, layouts, and API endpoints.
- **Important Files:** 
  - `layout.tsx`: The root layout injecting the Fluent UI providers and MSAL Auth wrappers.
  - `(protected)/dashboard/page.tsx`: The primary dashboard interface.
  - `api/`: The entire Backend-For-Frontend (BFF) proxy layer.
- **Dependencies:** `components/`, `lib/`, external APIs.

### `components/`
- **Purpose:** Reusable React components.
- **Structure:**
  - `ui/`: Wrappers around Fluent UI v9 components (e.g., `Button.tsx`, `Table.tsx`) to enforce enterprise styling constraints.
  - `layout/`: Structural elements like `TopNavigation.tsx` and `LeftSidebar.tsx`.
  - `tabs/`: The core business logic views. Contains monolithic files like `ParsingTab.tsx` and `MigrationValidationView.tsx` (some exceeding 2,500 lines).
  - `providers/`: Context providers, including `MsalProviderWrapper.tsx`.
- **Dependencies:** `stores/`, `lib/agentNames.ts`

### `stores/`
- **Purpose:** Global state management via Zustand.
- **Important Files:**
  - `agent.store.ts`: A massive (~1,800 line) store managing the polling, status, and telemetry of the 6-agent AI pipeline.
  - `ui.store.ts`: Manages active tabs, modals, and sidebar state.
- **Called By:** `components/tabs/*`
- **Calls:** `lib/fetchWithAuth.ts`

### `lib/`
- **Purpose:** Shared utilities and core networking logic.
- **Important Files:**
  - `fetchWithAuth.ts`: Intercepts client requests to inject the MSAL token.
  - `api/httpClient.ts`: Used strictly by the Next.js API routes (`app/api/*`) to dispatch requests to the external Python backends.
  - `env.ts`: Centralized environment variable parsing and validation.

### `services/`
- **Purpose:** Appears to contain legacy or secondary HTTP client wrappers (`http.client.ts`), although `lib/api/httpClient.ts` is the active module for API route forwarding.

### `types/`
- **Purpose:** Shared TypeScript definitions. (Note: Many types are improperly inlined at the top of large component files like `ParsingTab.tsx` instead of utilizing this directory).

### `__tests__/`
- **Purpose:** Vitest unit testing suites.
- **Important Files:** `MsalProviderWrapper.test.ts` (tests authentication lifecycle and token deduplication).
