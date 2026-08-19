# Dashboard Module

## Location
- `app/(protected)/dashboard/page.tsx`
- `components/tabs/DashboardTab.tsx`
- `stores/dashboard.store.ts`

## Functionality
The Dashboard is the landing page after authentication. It provides a high-level summary of:
1. Active migrations.
2. Historical migration success rates.
3. Connected services (Tableau, Qlik).

## State
The data is populated by fetching historical records via `/api/activities` when the component mounts. `dashboard.store.ts` stores this metadata to prevent re-fetching when the user navigates between tabs.
