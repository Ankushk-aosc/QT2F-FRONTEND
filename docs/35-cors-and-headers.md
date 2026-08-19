# CORS and Headers

## Overview
Because the Next.js application acts as the unified domain for the user, it inherently avoids most Cross-Origin Resource Sharing (CORS) issues between the browser and the backend.

- The browser only talks to the Next.js API (`/api/*`), which is on the exact same origin.
- The Next.js server (Node.js environment) talks to the Python external backends. Server-to-server HTTP requests are not subject to browser CORS policies.

## Next.js Configuration (`next.config.mjs`)
The `next.config.mjs` file does not currently define any explicit CORS headers or rewrites. 

## Missing Security Headers
Currently, the application does **not** inject standard security headers. A `next.config.mjs` update is recommended to add:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
