# Microsoft Fabric Integration

## Overview
Microsoft Fabric and PowerBI represent the target destination for the migration platform.

> [!WARNING]
> **Implementation vs. Documentation Mismatch:** Architecture documents often state that `.pbix` files are generated. However, based on the `MsalProviderWrapper.tsx` consent scopes (e.g., `Lakehouse.ReadWrite.All`, `Dataset.ReadWrite.All`, `Workspace.GitCommit.All`), the system is actually interacting with **Fabric REST APIs** to construct Semantic Models (Datasets) and Lakehouses dynamically in the cloud, rather than generating and downloading physical `.pbix` binary files.

## Authentication and Tokens
In `components/providers/MsalProviderWrapper.tsx`, the frontend acquires a specific token for Fabric:
1. **Fabric API Token:** `https://api.fabric.microsoft.com/.default` (Stored in `sessionStorage["fabric_access_token"]`)

## Migration Execution
When the migration reaches the **Data Layer** and **Generation** stages, the backend (Semantic Kernel and Fabric External Services) consumes these tokens to:
1. Create a Fabric Lakehouse.
2. Generate Data Pipelines or Notebooks to move data.
3. Use the PowerBI XMLA endpoint or Fabric REST APIs to construct Semantic Models populated with the translated DAX measures.
