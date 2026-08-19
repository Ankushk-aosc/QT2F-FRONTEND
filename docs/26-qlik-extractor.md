# Qlik Extractor Module

## Location
- `components/tabs/QlikMigrationTab.tsx`

## Functionality
Similar to the Tableau module, this module configures connection to a Qlik server.
1. **Forms:** Captures connection credentials.
2. **Dropdowns:** Fetches Qlik Spaces and Apps for user selection.
3. **Execution:** Routes the payload to `/api/qlik/agent-actions/generate-metadata` to trigger the AI processing.
