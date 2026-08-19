# State Management (Zustand)

## Location
- `stores/agent.store.ts`
- `stores/ui.store.ts`
- `stores/dashboard.store.ts`

## Functionality
As documented in the [Frontend Architecture](04-frontend-architecture.md), Zustand is used exclusively over React Context or Redux.

### `agent.store.ts` (The God Store)
This is the most critical file in the frontend (1,800+ lines). It handles:
- Polling the backend for logs.
- Deduplicating incoming log arrays.
- Computing percentage progress for progress bars.
- Storing manual overrides for validation.
- Tracking the active `run_id`.

> [!WARNING]
> **Performance Risk:** Because this store holds massive arrays of logs and mapping objects, and because React components subscribe to the entire store, it is highly susceptible to unnecessary re-renders. Large JSON payloads from the agents can cause severe browser lag if not paginated or memoized.
