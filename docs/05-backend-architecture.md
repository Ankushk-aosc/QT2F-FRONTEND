# Backend Architecture (Backend-For-Frontend)

## Overview
As established in the [System Overview](01-system-overview.md), the core Python backend (Semantic Kernel, AI Agents) is **not** hosted in this repository. 

The backend code in this repository (`app/api/*`) functions strictly as a **Backend-For-Frontend (BFF)**.

## The BFF Role
The Next.js API layer is responsible for:
1. **Security & Proxying:** Hiding external Python microservices from the browser.
2. **Auth Injection:** Extracting MSAL Bearer tokens from incoming Next.js headers or `sessionStorage` and forwarding them safely to backend services via `lib/api/httpClient.ts`.
3. **Payload Sanitization:** Reformatting or defaulting payload structures before hitting Semantic Kernel.

## Core Component: `httpClient.ts`
Located at `lib/api/httpClient.ts`, this is the heart of the BFF network layer. 

### API Types Mapping
The `httpClient.ts` file maps generic string identifiers to internal environment variable URLs:
- `apiType: "tableau"` → `process.env.TABLEAU_API_URL`
- `apiType: "semantic"` → `process.env.SEMANTIC_KERNEL_URL`
- `apiType: "logs"` → `process.env.LOGS_API_BASE`
- `apiType: "fabric"` → `process.env.FABRIC_API_BASE_URL`
- `apiType: "qlik"` → `process.env.QLIK_URL`

### Token Forwarding
The `request()` function inside `httpClient.ts` automatically extracts the `authorization` header from the incoming Next.js API request and attaches it to the outbound request to the Python backend.

```typescript
// From httpClient.ts
const headerStore = await headers();
const authHeader = headerStore.get("authorization");
if (authHeader) {
    requestHeaders["Authorization"] = authHeader;
}
```

> [!CAUTION]
> **Error Exposure Leak:** In multiple BFF routes (e.g., `process-site/route.ts`), error catch blocks return `err?.stack` directly to the client. This exposes backend stack traces to the browser, representing a significant Information Disclosure vulnerability.
