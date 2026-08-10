// lib/agentNames.ts

export const AGENT_NAME_VARIANTS: Record<string, string[]> = {
  assessment: ["Assessment Agent", "AssessmentAgent"],
  parsing: ["Parsing Agent", "Parser Agent", "ParsingAgent", "ParserAgent"],
  datalayer: ["DataLayerAgent", "Data Layer Agent"],
  mapping: ["Mapping Agent", "MappingAgent", "Mapper Agent"],
  generation: ["Generation Agent", "GenerationAgent", "Report Generation Agent"],
  validation: ["Validation Agent", "ValidationAgent", "Migration Validation Agent"],
}

export function matchesAgent(agentName: string, canonicalKey: string): boolean {
  if (!AGENT_NAME_VARIANTS[canonicalKey]) return false;
  return AGENT_NAME_VARIANTS[canonicalKey].includes(agentName);
}
