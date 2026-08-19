# Environment Variables

## Required Variables
The application relies on `.env.local` to map the BFF routing. 

### MSAL / Entra ID
- `NEXT_PUBLIC_CLIENT_ID`: The Azure AD Application ID.
- `NEXT_PUBLIC_AUTHORITY`: The Tenant URL (`https://login.microsoftonline.com/{tenant_id}`).
- `NEXT_PUBLIC_REDIRECT_URI`: The callback URL (e.g., `http://localhost:3000/api/auth/callback`).

### External API Routing (BFF targets)
These variables must map to the live Python/C# microservices:
- `SEMANTIC_KERNEL_URL`: Target for `/api/migration/process-site`.
- `LOGS_API_BASE`: Target for `/api/activities` and `/api/monitoring-logs`.
- `TABLEAU_API_URL`: Target for `/api/tableau/*`.
- `QLIK_URL`: Target for `/api/qlik/*`.
- `FABRIC_API_BASE_URL`: Target for Fabric generation endpoints.

> [!IMPORTANT]
> The code checks `process.env` dynamically in `lib/api/httpClient.ts`. If these are missing, API calls will fail with `ECONNREFUSED` or `Invalid URL` errors.
