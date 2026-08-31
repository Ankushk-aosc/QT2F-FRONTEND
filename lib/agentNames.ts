// lib/agentNames.ts

/**
 * Every `agent_name` spelling the agent-actions endpoint has been observed to
 * serve, grouped by canonical stage.
 *
 * There is no single right answer here: the backend has shipped the suffixed
 * form ("Assessment Agent") and the bare form ("Assessment", the one
 * lib/api/runContract.ts declares as AgentName), and which one a record carries
 * depends on when and by which agent it was written. `/api/activities` matches
 * agent_name exactly, so asking with the wrong spelling returns an empty page
 * rather than an error -- indistinguishable from "this stage hasn't run yet".
 *
 * That is why both readers fan out across every variant instead of picking one:
 *
 *   stores/agent.store.ts        -- stage gating and the Result tab
 *   hooks/useAgentActivities.ts  -- the sidebar's per-agent blocks
 *
 * The two used to disagree. agent.store asked only for the suffixed forms while
 * the sidebar asked only for the bare forms, so at most one of them could ever
 * find a given record: the sidebar sat on "Waiting for assessment agent..."
 * through an entire run whose activities the store had already read. Add new
 * spellings here and both callers pick them up.
 */
export const AGENT_NAME_VARIANTS: Record<string, string[]> = {
  assessment: ["Assessment Agent", "AssessmentAgent", "Assessment"],
  parsing: ["Parsing Agent", "Parser Agent", "ParsingAgent", "ParserAgent", "Parsing"],
  mapping: ["Mapping Agent", "MappingAgent", "Mapper Agent", "Mapping"],
  generation: [
    "Generation Agent",
    "GenerationAgent",
    "Report Generation Agent",
    "ReportGeneration",
    "Report Generation",
    "Generation",
  ],
  validation: ["Validation Agent", "ValidationAgent", "Migration Validation Agent", "Validation"],
};

/**
 * Stage keys used by the sidebar (`AgentStage`) mapped onto the canonical keys
 * above. Only `reportGeneration` actually differs; the rest pass through.
 */
const STAGE_ALIASES: Record<string, string> = {
  reportGeneration: "generation",
  report_generation: "generation",
};

/** Canonical key for a stage name, whichever spelling the caller uses. */
export function canonicalAgentKey(stage: string): string {
  return STAGE_ALIASES[stage] ?? stage;
}

/** Every agent_name worth asking for, for one stage. Empty for an unknown stage. */
export function agentNameVariants(stage: string): string[] {
  return AGENT_NAME_VARIANTS[canonicalAgentKey(stage)] ?? [];
}

export function matchesAgent(agentName: string, canonicalKey: string): boolean {
  const variants = AGENT_NAME_VARIANTS[canonicalAgentKey(canonicalKey)];
  if (!variants) return false;
  return variants.includes(agentName);
}
