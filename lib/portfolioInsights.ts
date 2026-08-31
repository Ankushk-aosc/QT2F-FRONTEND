import type { AssessmentData, MappedData } from "@/types/assessment";

export function getAssessmentCategoryValue(data: AssessmentData | undefined, category: string): string {
  if (!data?.results || !Array.isArray(data.results)) return "Not assessed";
  const item = data.results.find((r) => r.category?.toLowerCase() === category.toLowerCase());
  if (!item) return "Not assessed";
  const { value } = item;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return "Unknown";
}

export interface PortfolioApp {
  appId: string;
  appName: string;
  assessmentData?: AssessmentData;
  mappedData?: MappedData;
}

export interface PortfolioRow {
  appId: string;
  appName: string;
  complexity: string;
  queryComplexity: string;
  mappedFieldPercentage: number | null;
  unmappedFieldCount: number | null;
}

export function buildPortfolioRows(apps: PortfolioApp[]): PortfolioRow[] {
  return apps
    .filter((a) => a.assessmentData)
    .map((a) => ({
      appId: a.appId,
      appName: a.appName,
      complexity: getAssessmentCategoryValue(a.assessmentData, "Complexity"),
      queryComplexity: getAssessmentCategoryValue(a.assessmentData, "Query Complexity"),
      mappedFieldPercentage: a.mappedData?.mapping_report?.mapped_percentage ?? null,
      unmappedFieldCount: Array.isArray(a.mappedData?.mapping_report?.unmapped_fields)
        ? a.mappedData!.mapping_report.unmapped_fields.length
        : null,
    }));
}

export function buildPortfolioTotals(rows: PortfolioRow[]) {
  return {
    totalApps: rows.length,
    highComplexity: rows.filter((r) => r.complexity.toLowerCase() === "high").length,
    mediumComplexity: rows.filter((r) => r.complexity.toLowerCase() === "medium").length,
    lowComplexity: rows.filter((r) => r.complexity.toLowerCase() === "low").length,
  };
}
