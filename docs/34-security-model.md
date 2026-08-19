# Security Model

## Authentication Boundary
The frontend and BFF (Next.js) rely entirely on Microsoft Entra ID (MSAL) for authentication. 

## Trust Delegation
1. **Frontend to BFF:** The React SPA passes the JWT Bearer token in the `Authorization` header.
2. **BFF to Backend:** The Next.js BFF acts as a dumb proxy. It extracts the `Authorization` header and passes it to the Python services without validating the signature or claims itself.
3. **Backend Validation:** The Python API (`semantic`, `logs`, etc.) is responsible for actually validating the token signature against Azure AD.

## Known Security Vulnerabilities in Repository
Based on code audits:
1. **No Next.js Route Protection:** There is no `middleware.ts`. Anyone can hit `/api/migration/process-site`, and Next.js will blindly forward the request. It relies entirely on the downstream Python service to reject unauthorized calls.
2. **Information Disclosure (Error Leaks):** `httpClient.ts` catches downstream errors and returns `err.stack` directly in the HTTP JSON response, leaking backend folder structures and logic to the browser.
3. **Storage Risks:** The MSAL tokens are stored in `sessionStorage`. While better than `localStorage`, it is still vulnerable to XSS (Cross-Site Scripting). If any dependency is compromised, an attacker can steal the MSAL bearer token. Moving to `HttpOnly` cookies via Next-Auth (Auth.js) would be significantly safer.
