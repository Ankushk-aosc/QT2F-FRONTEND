# Semantic Kernel Implementation

> [!WARNING]
> **Implementation Missing:** As noted in [14-ai-architecture.md](14-ai-architecture.md), there is no Semantic Kernel implementation (Plugins, Prompt Templates, Memory, Planners) present in this Next.js repository.

All Semantic Kernel interactions occur on the external Python/C# backend (`process.env.SEMANTIC_KERNEL_URL`). The Next.js BFF simply forwards HTTP payloads to this URL to initialize execution.
