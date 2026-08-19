# Authentication & Authorization

## Overview
The platform uses **Microsoft Entra ID (Azure AD)** via the Microsoft Authentication Library (MSAL). Specifically, it uses `@azure/msal-browser` and `@azure/msal-react` for client-side authentication.

## Authentication Flow

```mermaid
flowchart TD
    A[Unauthenticated User] -->|Visits /| B[Next.js page.tsx]
    B -->|Redirect| C[/signin]
    C -->|clicks Login| D[MSAL instance.loginRedirect]
    D -->|Auth Request| E[Microsoft Entra ID]
    E -->|Redirect with Code| F[/api/auth/callback]
    F -->|handleRedirectPromise| G[MsalProviderWrapper.tsx]
    G -->|Extracts Token| H[sessionStorage]
    H -->|Access Granted| I[/dashboard]
```

## Token Management (`MsalProviderWrapper.tsx`)
The authentication lifecycle is managed in a massive singleton wrapper: `components/providers/MsalProviderWrapper.tsx`.

### Storage
Tokens are stored in `sessionStorage` (e.g., `access_token`, `fabric_access_token`) to mitigate long-term XSS persistence risks compared to `localStorage`.

### Scopes & Consent
The application requires multiple API scopes and actively validates them in `ensureConsent()`:
- `globalApiScope` (Dynamic backend scope)
- `https://api.fabric.microsoft.com/.default` (Microsoft Fabric)
- `https://analysis.windows.net/powerbi/api/.default` (PowerBI Service)

### Proactive Refresh
`MsalProviderWrapper.tsx` runs an active `setInterval` every 20 minutes to call `acquireTokenSilent()` across all primary scopes to prevent timeouts during long-running Semantic Kernel background migrations.

## Backend Validation
The Next.js BFF does **not** validate the JWT token signatures itself (there is no `middleware.ts` for route protection). 
Instead, `lib/fetchWithAuth.ts` attaches the token to the request header, and the BFF passes the header transparently to the Python backends via `httpClient.ts`. 

> [!WARNING]
> **Missing Middleware Validation:** Because Next.js `middleware.ts` is missing, API routes are only protected by the downstream Python services rejecting the token. The Next.js API routes themselves do not pre-validate the JWT signature.
