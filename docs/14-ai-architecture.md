# AI Architecture & Semantic Kernel

## Overview

The core value of this platform is an AI-driven migration engine. 

> [!IMPORTANT]
> **Missing from Repository:** The Next.js repository **does not contain any LLM provider code, prompt construction, token handling, or Semantic Kernel code**. There is no Python code, LangChain, or Microsoft Semantic Kernel C#/Python code present in the analyzed codebase. 

## How the Application Interfaces with AI

The Next.js application treats the Semantic Kernel AI as a "Black Box" external service. 

1. **Triggering AI:** The frontend calls `/api/migration/process-site`, which forwards the request to `process.env.SEMANTIC_KERNEL_URL`.
2. **Monitoring AI:** The frontend polls `/api/activities` (which polls `process.env.LOGS_API_BASE`).
3. **Telemetry Mapping:** The Next.js frontend has hardcoded logic in `stores/agent.store.ts` to expect specific log events from the AI. When the Python backend logs a message like `{"type": "AGENT_STATUS", "agent_name": "Agent 3 - Mapping"}`, the Next.js `agent.store.ts` updates the UI progress bars accordingly.

## Known Architecture (Based on external integrations)
While the code isn't here, the UI structure proves the external Semantic Kernel is orchestrated as a sequential **6-Agent Pipeline**:
- Agent 1: Assessment
- Agent 2: Parsing
- Agent 3: Mapping
- Agent 4: Data Layer
- Agent 5: Generation
- Agent 6: Validation

*(See the individual Agent documents in this directory for what the UI expects these agents to do).*
