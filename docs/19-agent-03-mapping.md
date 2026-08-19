# Agent 3: Mapping

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/MappingTab.tsx`) expects from this agent.

## Purpose
The Mapping Agent takes the raw parsed formulas (from Agent 2) and uses Large Language Models (LLMs) to map them into the target dialect (e.g., DAX for Microsoft Fabric).

## Expected Output (Frontend State)
The UI renders a horizontal table comparing:
- `Original Source Formula` (e.g., `FIXED [Region] : SUM([Sales])`)
- `Target Destination Formula` (e.g., `CALCULATE(SUM('Sales'[Sales]), ALLEXCEPT('Sales', 'Sales'[Region]))`)
- `Confidence Score`: Indicates the LLM's certainty of the translation.
