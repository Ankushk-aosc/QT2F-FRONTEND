# Agent 2: Parsing

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/ParsingTab.tsx`) expects from this agent.

## Purpose
The Parsing Agent breaks down the underlying XML (.twb) or Qlik Engine objects into structured abstract syntax trees (AST).

## Expected Output (Frontend State)
`ParsingTab.tsx` explicitly types the expected payload from this agent:
- `DataSource[]`: Server connections, Custom SQL flags.
- `LogicalRelationship[]` / `PhysicalJoin[]`: How tables join together.
- `CalcField[]`: Names and raw formulas of calculations.
- `Parameter[]`: Allowable values and current states.
- `SetDef[]`: Base fields and conditions for SETs.
