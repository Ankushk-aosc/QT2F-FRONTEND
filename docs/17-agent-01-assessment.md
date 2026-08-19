# Agent 1: Assessment

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/AssessmentTab.tsx`) expects from this agent.

## Purpose
The Assessment Agent analyzes the source Tableau Workbook or Qlik App to determine the complexity and feasibility of the migration.

## Expected Output (Frontend State)
The UI expects a JSON payload from the API containing:
- **Metrics:** Counts of Data Sources, Worksheets, Dashboards, and Story Points.
- **Complexity Score:** A computed rating of how difficult the migration will be.
- **Risk Flags:** Array of objects `{ label: string, danger: boolean }` highlighting unsupported features (e.g., custom SQL, specific LOD types).
