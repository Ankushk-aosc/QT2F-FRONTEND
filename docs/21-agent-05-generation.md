# Agent 5: Generation

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/GenerationTab.tsx` / `ResultTab.tsx`) expects from this agent.

## Purpose
The Generation Agent utilizes the Fabric REST APIs (or XMLA endpoints) to generate the final Semantic Models (Datasets) and blank reports.

## Expected Output (Frontend State)
The UI renders links to the newly generated Fabric Workspaces and Semantic Models.
