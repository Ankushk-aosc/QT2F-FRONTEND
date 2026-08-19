# File Upload Module

## Location
- `components/tabs/MigrationTab.tsx`
- *No dedicated upload API found in `/api`.*

## Functionality
For users who do not have a live Tableau Server/Cloud connection, they can upload a physical `.twbx` (Tableau Packaged Workbook) file.

> [!WARNING]
> **Implementation Gap:** The Next.js API layer `/api/migration/process-site` currently assumes the backend extracts files via a server connection. If file upload logic is executed, it likely posts the raw `FormData` directly through `fetchWithAuth.ts` to the backend.
