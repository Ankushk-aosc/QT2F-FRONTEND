# Manual Validation (Human in the Loop)

## Location
- `components/tabs/ParsingTab.tsx`
- `components/tabs/MappingTab.tsx`
- `components/tabs/MigrationValidationView.tsx`

## Functionality
Because the Semantic Kernel is not 100% perfect, the system is designed to pause after certain AI Agents complete to require human sign-off.

1. **Mapping Overrides:** In `MappingTab.tsx`, if the LLM confidence score is low, a user can manually edit the DAX translation.
2. **State Updates:** When they edit, `agent.store.ts` captures this override.
3. **Resumption:** The user clicks "Approve & Continue". The frontend calls `/api/migration/resume` with the updated JSON payload, feeding the manual corrections back into the Semantic Kernel to continue the pipeline.
