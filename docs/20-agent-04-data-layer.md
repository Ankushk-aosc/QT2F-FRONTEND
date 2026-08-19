# Agent 4: Data Layer

> [!WARNING]
> **Implementation Boundary:** The backend logic for this agent is external. This document explains what the Next.js UI (`components/tabs/DataLayerTab.tsx`) expects from this agent.

## Purpose
The Data Layer Agent constructs the physical data models (Lakehouses, Warehouses, Tables, Relationships) inside Microsoft Fabric.

## Expected Output (Frontend State)
The UI expects to receive schemas mapping:
- `Source Tables` to `Fabric Lakehouse Tables`.
- `Relationship Keys` showing how the semantic model will link facts to dimensions.
