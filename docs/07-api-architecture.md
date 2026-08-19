# API Architecture

## Next.js API Routes (BFF)

The API layer is built inside the `app/api/` directory using Next.js 15 Route Handlers (`route.ts`).

### Directory Structure
```text
app/api/
├── auth/            # Dynamic MSAL config and Refresh Token seeding
│   ├── callback/
│   ├── config/
│   └── seed-rt/
├── migration/       # Semantic Kernel & Agent orchestrators
│   ├── process-site/
│   ├── data-layer/
│   └── ...
├── tableau/         # Tableau specific endpoints
│   ├── connections/
│   ├── server-projects/
│   └── workbooks/
└── qlik/            # Qlik specific endpoints
    ├── spaces/
    ├── apps/
    └── agent-actions/
```

### Standard Implementation Pattern
Almost all routes in this application follow an identical proxy pattern:

1. **Receive Request:** Extract `query`, `body`, or `params`.
2. **Forward via HttpClient:** Call `httpGet` or `httpPost` imported from `@/lib/api/httpClient`, tagging it with a specific `apiType` (e.g., `"semantic"`, `"tableau"`).
3. **Catch & Return:** Wrap the call in a `try/catch` and return `NextResponse.json`.

```typescript
// Example Implementation (app/api/migration/data-layer/route.ts)
import { NextRequest, NextResponse } from "next/server";
import { httpGet, errorResponse } from "@/lib/api/httpClient";

export async function GET(req: NextRequest) {
    try {
        const query = new URL(req.url).searchParams.toString();
        // Forwards request to LOGS API backend
        const result = await httpGet<unknown>("logs", `/data-layer?${query}`);
        return NextResponse.json(result.data, { status: 200 });
    } catch (err: unknown) {
        const { body, status } = errorResponse(err, "Failed");
        return NextResponse.json(body, { status }); // WARNING: errorResponse leaks err.stack here
    }
}
```

### Error Handling
The `errorResponse` function in `httpClient.ts` catches HTTP errors and passes them back to the frontend. As noted in the architecture audits, this currently leaks stack traces to the browser and must be sanitized.
