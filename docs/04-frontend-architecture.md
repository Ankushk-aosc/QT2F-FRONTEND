# Frontend Architecture

## Overview
The frontend is built on **Next.js 15 (App Router)** and **React 19**, styled entirely with **Microsoft Fluent UI v9**. It operates as a Single Page Application (SPA) client enclosed within the Next.js server framework.

## Core Structure
```text
app/
├── (auth)/                # Unauthenticated routes (signin)
├── (protected)/           # Authenticated routes
│   └── dashboard/         # The primary workspace for migration
├── layout.tsx             # Root layout injecting Fluent UI Provider
└── page.tsx               # Entry point (handles auth redirects)
```

## State Management (Zustand)
Global state is managed via `Zustand` and is heavily centralized. 
Stores are located in `stores/`:
- `agent.store.ts`: A massive central store (1,800+ lines) managing migration state, telemetry logs, and manual validation overrides.
- `ui.store.ts`: Manages sidebar expansion, active tabs, and modal visibility.
- `dashboard.store.ts`: General dashboard metrics.
- Sub-stores: `parsing.store.ts`, `mapping.store.ts` (often mapped into monolithic views).

## Components & Layouts
Components are stored in `components/`.
- `ui/`: Strict wrappers around Fluent UI components (`Button`, `Table`, `Badge`) to enforce design system consistency.
- `layout/`: Shell components like `LeftSidebar.tsx` and `TopNavigation.tsx`.
- `tabs/`: The primary interactive surfaces of the application.

> [!WARNING]
> **God Components Identified:** The files within `components/tabs/` (e.g., `ParsingTab.tsx`, `MigrationValidationView.tsx`) are extremely monolithic, some exceeding 2,700 lines. They mix state derivation, API fetching, and UI rendering into single files, which violates React composition best practices.

## Networking Layer
The frontend never communicates with external services directly.
1. `hooks/useAuth.ts` and `components/providers/MsalProviderWrapper.tsx` acquire MSAL bearer tokens.
2. `lib/fetchWithAuth.ts` intercepts outbound frontend requests to inject the token.
3. Requests are sent to the Next.js BFF (`/api/*`).
