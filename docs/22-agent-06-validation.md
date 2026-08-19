# Agent 6: Validation

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/MigrationValidationView.tsx`) expects from this agent.

## Purpose
The Validation Agent runs automated tests comparing the source system (Tableau) with the target system (Fabric).

## Expected Output (Frontend State)
The `MigrationValidationView.tsx` component is massive (216 KB) and expects extremely detailed validation data:
- `Data Type Mismatches`
- `Row Count Mismatches`
- `Calculation Verification` (Are the DAX measures producing the same numbers as the Tableau calculations?)
