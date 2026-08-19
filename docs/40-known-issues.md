# Known Issues and Flaws

This document catalogs the architectural flaws and technical debt discovered during the documentation audit of this repository.

## 1. Information Disclosure (Security)
In `lib/api/httpClient.ts`, the `errorResponse` function returns the internal backend error back to the frontend:
```typescript
return {
  status: response.status,
  body: { error: true, message: data.message, stack: data.stack }
}
```
If the Python backend throws an error, the full stack trace is exposed to the browser. This violates OWASP API Security Top 10 (API7:2023 Security Misconfiguration).

## 2. Monolithic "God Objects"
- **`stores/agent.store.ts`:** Exceeds 1,800 lines. It handles API polling, telemetry logic, mapping override arrays, and UI progress state simultaneously. It should be split into `telemetry.store.ts` and `validation.store.ts`.
- **`components/tabs/MigrationValidationView.tsx`:** Over 2,700 lines. It renders massive tables, handles pagination, parses complex JSON, and manages local state, making it extremely difficult to maintain.

## 3. Lack of BFF Route Protection
The `app/api/*` routes do not validate the MSAL JWT. They blindly trust that if a token is in the header, the downstream Python API will reject it if invalid. While functionally true, the Next.js API layer is open to Denial of Service (DoS) attacks since it will happily process and forward unauthenticated traffic without a `middleware.ts` guard.

## 4. Polling Overhead
The Next.js frontend uses aggressive `setInterval` polling for `/api/activities` and `/api/monitoring-logs`. For a complex migration involving hundreds of dashboards, the log payload grows massive. Re-fetching the entire log history every 3 seconds degrades browser performance. This should be migrated to Server-Sent Events (SSE) or WebSockets.

## 5. Next.js Config Limitations
- No `output: "standalone"` in `next.config.mjs` for optimized Docker builds.
- Missing CSP and security headers.
