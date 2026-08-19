# Tableau Extractor Module

## Location
- `components/tabs/MigrationTab.tsx` (Contains the form)
- `components/MigrationTab/*` (Sub-components)

## Functionality
This module is responsible for capturing the connection details for Tableau:
1. **Forms:** Collects URL, Site Name, PAT.
2. **Dropdowns:** Once connected, the user selects a specific **Project** from a dropdown, which subsequently populates a **Workbook** dropdown.
3. **Execution:** Submitting this form begins the [Migration Workflow](23-migration-workflow.md).
