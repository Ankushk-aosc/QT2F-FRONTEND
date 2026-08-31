import type { AssessmentData } from "@/types/assessment";

/**
 * Maps the raw assessment-bot payload (see `assessment-example.json`) into a
 * shape the Assessment Results view can render directly.
 *
 * The bot returns `results` as a flat array of `{ category, value }` pairs where
 * `value` is a string, a number, an array, or an object whose "headline" key
 * differs per category (`level` / `priority` / `quality` / `status` /
 * `recommendation` / `model_type` / `structure`). Everything below normalises
 * that, and — importantly — keeps the `details` arrays, which carry the bulk of
 * the assessment's reasoning and were previously dropped on the floor.
 */

export type Tone = "success" | "warning" | "danger" | "informative";

/**
 * Categories where a high reading is bad (complexity, volume, sensitivity…).
 *
 * The readings are not all on a low/medium/high scale: Data Volume answers
 * "Small"/"Moderate"/"Large" and Migration Challenges answers with an effort
 * word. Keying only on low/medium/high meant every one of those fell through to
 * "informative", so a "Large" data volume rendered in the same neutral grey as
 * an unknown value.
 */
const RISK_TONE: Record<string, Tone> = {
  low: "success",
  minimal: "success",
  none: "success",
  small: "success",
  medium: "warning",
  moderate: "warning",
  high: "danger",
  large: "danger",
  critical: "danger",
  "very high": "danger",
};
/**
 * Categories where a high reading is good (documentation quality, data-model
 * quality). Same widening as RISK_TONE: the payload says "Poor"/"Fair"/"Good",
 * never a bare low/medium/high.
 */
const QUALITY_TONE: Record<string, Tone> = {
  low: "danger",
  poor: "danger",
  bad: "danger",
  medium: "warning",
  fair: "warning",
  moderate: "warning",
  high: "success",
  good: "success",
  excellent: "success",
};

export interface RatingCategory {
  /** Stable key for React lists and PDF export. */
  key: string;
  label: string;
  /** The headline reading: "Medium", "Replicable", "No Issues", … */
  value: string;
  details: string[];
  tone: Tone;
}

export interface DatasetField {
  name: string;
  type: string;
  isKey: boolean;
}

export interface DatasetTable {
  name: string;
  fields: DatasetField[];
  fieldCount: number;
  keyCount: number;
  /** From the Dimensional Model category; "Unclassified" when the bot said nothing. */
  role: "Fact" | "Dimension" | "Unclassified";
  /** The bot's own justification, e.g. "high numeric ratio: 10/11". */
  roleReason: string;
}

export interface ConnectionInfo {
  name: string;
  database: string;
  driver: string;
  provider: string;
  server: string;
  port: string;
  schema: string;
  role: string;
  warehouse: string;
  sourceConnector: string;
}

export interface KpiEntry {
  sheetName: string;
  title: string;
  visualizationType: string;
}

export interface KpiSheetGroup {
  sheetName: string;
  kpis: KpiEntry[];
}

/**
 * A literal custom color picked on a visual (hex string), and which visuals
 * use it. Qlik's `colours_used` is mostly palette *index* references (e.g.
 * `paletteColor.index: 6`) that point into a theme resource this payload
 * never includes -- unresolvable to an actual color. The one case that IS
 * resolvable: index `-1` means "not a palette slot", and a literal `color`
 * hex string sits alongside it. This is the Qlik-real subset of T2F's
 * "Unique Custom Colors" -- narrower (per-visual, not workbook-wide, and
 * only the colors a user explicitly hand-picked outside the palette), but
 * every entry is a real color, not an invented swatch.
 */
export interface CustomColorUsage {
  color: string;
  visuals: string[];
}

export interface QueryFinding {
  /** 1-based query number as reported by the bot. */
  index: number;
  subqueryCount: number;
  /** The truncated script excerpt the bot echoed back. */
  snippet: string;
}

export interface ChallengePair {
  challenge: string;
  /** Matching line from Power BI Replicability, or "" when nothing lines up. */
  replicabilityNote: string;
}

/**
 * A Qlik master item (a master dimension or master measure).
 *
 * These arrive under their own `Dimensions` / `Measures` categories and carry
 * the expressions that have to be rewritten in DAX -- the single most useful
 * thing in the payload for estimating migration effort. Nothing read them
 * before, so all 39 master items in the sample response were dropped.
 */
export interface MasterItem {
  name: string;
  /** The Qlik expression, e.g. `Sum(revenue)/1000000`. */
  expression: string;
  description: string;
  /** Storage/semantic type as reported, e.g. "NUMBER (CALCULATED)". */
  dataType: string;
  /** Source tables the item references; empty when the bot reported none. */
  tables: string[];
}

/** One Section Access rule set -- Qlik's row-level security. */
export interface SectionAccessRule {
  /** Table the rule was loaded against, e.g. "SECTION_ACCESS". */
  table: string;
  fields: string[];
  /** Fields carrying the access level itself, e.g. ["ACCESS"] (ADMIN/USER). */
  securityFields: string[];
  /** Fields a row's grant is reduced by, e.g. ["USER.EMAIL", "HOME_TERMINAL"]. */
  reductionFields: string[];
  rows: Array<Record<string, string>>;
}

/** A real per-table LOAD script, from `datasets.datasets[].source_query`. */
export interface LoadScript {
  tableName: string;
  script: string;
}

/** One Qlik variable (`variables.details[]`) -- system-reserved or user-defined. */
export interface VariableItem {
  name: string;
  /** The variable's defined expression/value, e.g. `,` for ThousandSep. */
  definition: string;
  description: string;
  /** The literal `SET x=y;`/`LET x=y;` script line, when the bot captured one. */
  scriptStatement: string;
  isReserved: boolean;
  tags: string[];
}

/** One Qlik bookmark (`bookmarks.details[]`) -- a saved selection state. */
export interface BookmarkItem {
  title: string;
  description: string;
  sheetId: string;
  /** ISO timestamp as reported; formatted for display at render time. */
  creationDate: string;
  isPublic: boolean;
}

export interface QlikAssessment {
  reportName: string;
  status: string;
  fileType: string;

  totalPages: number;
  kpiCount: number;
  kpis: KpiEntry[];
  kpisBySheet: KpiSheetGroup[];
  sheetsWithKpis: number;

  /**
   * Every visualization on every sheet -- kpi, barchart, linechart, piechart,
   * filterpane, sn-table, gauge, scatterplot, treemap, boxplot, extension
   * charts, etc. `kpis` above stays KPI-tile-only (what Overview's "Total
   * KPIs" tile reports); this is the unfiltered set the Visuals & KPIs tab
   * renders so no visualization type is silently dropped.
   */
  visuals: KpiEntry[];
  visualsBySheet: KpiSheetGroup[];
  visualCount: number;
  sheetsWithVisuals: number;
  /** Literal custom (non-palette) colors picked on visuals -- see `CustomColorUsage`. */
  customColors: CustomColorUsage[];

  datasets: DatasetTable[];
  datasetCount: number;
  totalFields: number;
  totalKeys: number;
  factCount: number;
  dimensionCount: number;

  dataModelStructure: string;
  dataModelStats: string;
  dataModelDetails: string[];
  dimensionalModelType: string;
  /** Dimensional Model lines that aren't per-table classifications. */
  dimensionalNotes: string[];

  connections: ConnectionInfo[];
  databaseName: string;

  queryFindings: QueryFinding[];
  /** Query Complexity lines that aren't per-query findings. */
  queryNotes: string[];
  /**
   * Tables whose real LOAD script contains a raw `SQL SELECT` passthrough
   * block (vs. pure Qlik LOAD/Resident transformation logic) -- see
   * `loadScripts`. Qlik's actual analog to T2F's Custom SQL count; replaced
   * "Subqueries Found" 2026-08-19, which was hardcoded to 0 for every app
   * (leftover from a Tableau-bot prose format the Qlik bot never emits).
   */
  customSqlCount: number;

  screenshotCount: number;
  screenshotDetails: string[];
  screenshots: unknown[];

  powerBi: { recommendation: string; details: string[]; tone: Tone };
  /** Complexity, Criticality, Documentation, Sensitivity, Volume, Challenges, Query, Unsupported. */
  ratings: RatingCategory[];
  challenges: ChallengePair[];

  /** Top-level `ai_summary` -- the bot's own migration verdict, in prose. */
  aiSummary: string[];

  masterDimensions: MasterItem[];
  masterMeasures: MasterItem[];
  masterDimensionCount: number;
  masterMeasureCount: number;

  /** Qlik Section Access rules; empty when the app has none. */
  sectionAccess: SectionAccessRule[];
  hasSectionAccess: boolean;

  /** Real per-table LOAD scripts, from `datasets.datasets[].source_query`. */
  loadScripts: LoadScript[];

  variables: VariableItem[];
  bookmarks: BookmarkItem[];
  variableCount: number;
  bookmarkCount: number;

  /** From `metadata.metadata` -- the Qlik Cloud app record, not the bot's own analysis. */
  ownerName: string;
  ownerEmail: string;
  spaceName: string;
  /** ISO timestamps as reported; formatted for display at render time. */
  lastModified: string;
  lastReloadTime: string;
  createdDate: string;
  /** On-disk app size in bytes, from `resource_size.appFile`; 0 when unreported. */
  appFileSizeBytes: number;
  /**
   * Qlik Cloud's flat privilege list for this app, e.g. "read", "update",
   * "export" -- from `metadata.metadata.privileges`. Unlike T2F's Tableau
   * `workbook_permissions` (a list of grantees, each with its own Allow/Deny
   * capability set), Qlik reports one flat list of privileges the app itself
   * carries; there is no per-grantee breakdown and no explicit "Deny" --
   * everything listed here is granted.
   */
  privileges: string[];

  /** 0-100 as scored by the bot, or null when it reported none. */
  complexityScore: number | null;
  /** e.g. "High" -- the bot's rework estimate from Migration Challenges. */
  reworkEffort: string;
  /** Field names flagged as personally identifiable. */
  piiFields: string[];
  complianceRisk: string;
  syntheticKeysDetected: boolean;
  circularReferencesDetected: boolean;
  /** e.g. "Millions (likely 1M-10M+ across main fact tables)". */
  rowCountEstimate: string;
  /** The bot's Import/DirectQuery call for Power BI. */
  storageModeRecommendation: string;

  raw: AssessmentData | null;
}

/* ──────────────────────────────────────────────────────────────
   Low-level helpers
   ────────────────────────────────────────────────────────────── */

/** Splits on `separator`, ignoring separators nested inside parentheses. */
function splitTopLevel(input: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** `"HIVE_INFORMATION (APIARYID (NUMBER), …)"` → name + inner body. */
function splitNameAndBody(entry: string): { name: string; body: string } {
  const open = entry.indexOf("(");
  if (open === -1 || !entry.trimEnd().endsWith(")")) {
    return { name: entry.trim(), body: "" };
  }
  return {
    name: entry.slice(0, open).trim(),
    body: entry.slice(open + 1, entry.lastIndexOf(")")).trim(),
  };
}

/**
 * Key detection for individual fields. The bot doesn't flag keys per field, so
 * we fall back to the naming convention every table in the payload follows:
 * APIARYID, HIVEID, STATIONID, HOURLY_WEATHER.OBSID…
 * Table-level counts prefer the Dimensional Model numbers over this — see
 * `parseDatasets`.
 */
function looksLikeKey(fieldName: string): boolean {
  const bare = fieldName.includes(".") ? fieldName.split(".").pop() ?? fieldName : fieldName;
  return /(?:id|key)$/i.test(bare);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Every field this reads (ai_summary, fact_tables_identified, tags, ...) is
 * documented/sampled as an array, but a single-item field is an easy place
 * for a backend to send the bare value instead of a one-element array --
 * this silently returned `[]` for that shape rather than `[value]`, which is
 * the likely reason Migration Overview's Executive Summary sometimes falls
 * through to its generic rule-based text: a live run's `ai_summary` coming
 * back as a plain string reads as "no summary" instead of the real one.
 */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

export function unwrapAssessment(rawDoc: any): any {
  if (!rawDoc) return null;
  const doc = Array.isArray(rawDoc) ? rawDoc[0] : rawDoc;
  if (!doc || typeof doc !== "object") return null;

  if (Array.isArray(doc.results)) return doc;
  if (doc.payload && Array.isArray(doc.payload.results)) return doc.payload;
  if (doc.assessment_result && Array.isArray(doc.assessment_result.results)) return doc.assessment_result;
  if (doc.payload?.assessment_result && Array.isArray(doc.payload.assessment_result.results)) return doc.payload.assessment_result;
  if (doc.data && Array.isArray(doc.data.results)) return doc.data;
  if (doc.data?.assessment_result && Array.isArray(doc.data.assessment_result.results)) return doc.data.assessment_result;

  return doc.assessment_result ?? doc.payload?.assessment_result ?? doc.payload ?? doc.data ?? doc;
}

/* ──────────────────────────────────────────────────────────────
   Category readers
   ────────────────────────────────────────────────────────────── */

function makeReader(data: AssessmentData | null) {
  const source = unwrapAssessment(data);
  const results = source && Array.isArray(source.results) ? source.results : [];
  return (category: string): unknown => {
    const hit = results.find((r: any) => String(r?.category ?? "").toLowerCase() === category.toLowerCase());
    return hit ? hit.value : undefined;
  };
}

/** Pulls the headline reading out of a category value, whatever key it hides behind. */
function headline(value: unknown, fallback = "Unknown"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  const record = asRecord(value);
  if (!record) return fallback;
  // The generic names first, then the per-category ones the current response
  // uses. Without the latter every rating headline reads "Unknown": the payload
  // says `complexity_level` / `model_quality` / `challenge_level`, never a bare
  // `level` or `quality`.
  for (const key of [
    "level",
    "priority",
    "quality",
    "status",
    "recommendation",
    "model_type",
    "structure",
    "risk_level",
    "complexity_level",
    "criticality_level",
    "replicability_level",
    "documentation_quality",
    "sensitivity_level",
    "volume_category",
    "challenge_level",
    "model_quality",
  ]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return fallback;
}

/**
 * Keys that carry a category's supporting prose.
 *
 * The bot used to return one `details` array of sentences per category. The
 * current response spreads the same material across named keys instead, so read
 * whichever are present — otherwise every rating renders as a headline with no
 * explanation beneath it.
 */
const DETAIL_KEYS = [
  "details",
  "reasoning",
  "recommendations",
  "technical_challenges",
  "undocumented_metrics",
  "unsupported_qlik_features",
  "powerbi_features_required",
  "complex_operations",
  // Dimensional Model's key is singular ("transformation_required"); kept
  // the plural too in case an older/other deployment still emits that spelling.
  "transformation_required",
  "transformation_requirements",
  "identified_challenges",
  "governance_recommendation",
  "power_query_recommendation",
  "migration_strategy",
] as const;

/**
 * `undocumented_metrics` is a bare count (`29`), not a list -- every other
 * DETAIL_KEYS entry is prose or a structured finding, so the generic
 * `detailText()` path would render it as a lone "29" bullet with no context.
 */
function formatUndocumentedMetrics(raw: unknown): string | null {
  if (typeof raw !== "number") return null;
  return `${raw} undocumented metric${raw === 1 ? "" : "s"} identified`;
}

/** Renders one detail entry, which may be a sentence or a structured finding. */
function detailText(entry: unknown): string {
  if (typeof entry === "string") return entry.trim();
  if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
  const record = asRecord(entry);
  if (!record) return "";
  // e.g. identified_challenges: { feature, description, powerbi_alternative }
  const head = [record.feature, record.name, record.title].find(
    (value) => typeof value === "string" && value.trim(),
  );
  const body = [record.description, record.reason, record.detail].find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (head && body) return `${head}: ${body}`;
  return String(head ?? body ?? "");
}

function details(value: unknown): string[] {
  const record = asRecord(value);
  if (!record) return [];
  const out: string[] = [];
  for (const key of DETAIL_KEYS) {
    const raw = record[key];
    if (raw === undefined || raw === null) continue;
    if (key === "undocumented_metrics") {
      const formatted = formatUndocumentedMetrics(raw);
      if (formatted) out.push(formatted);
      continue;
    }
    if (Array.isArray(raw)) {
      out.push(...raw.map(detailText).filter(Boolean));
    } else {
      const text = detailText(raw);
      if (text) out.push(text);
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   Per-category parsers
   ────────────────────────────────────────────────────────────── */

/**
 * `"Table 'HCC_INSPECTIONS' identified as FACT table (high numeric ratio: 10/11)."`
 * The bot states key counts as either `keys: N` or `N foreign keys`; both are
 * authoritative and beat the naming heuristic.
 */
function parseDimensionalModel(lines: string[]) {
  const byTable = new Map<string, { role: "Fact" | "Dimension" | "Unclassified"; reason: string; keys: number | null }>();
  const notes: string[] = [];

  for (const line of lines) {
    const match = line.match(/Table\s+'([^']+)'\s+identified as\s+(\w+)\s+table\s*\(([^)]*)\)/i);
    if (!match) {
      notes.push(line);
      continue;
    }
    const [, table, rawRole, reason] = match;
    const role = /fact/i.test(rawRole) ? "Fact" : /dimension/i.test(rawRole) ? "Dimension" : "Unclassified";
    const explicitKeys = reason.match(/keys:\s*(\d+)/i) ?? reason.match(/(\d+)\s+foreign\s+keys/i);
    byTable.set(table, {
      role,
      reason: reason.trim(),
      keys: explicitKeys ? Number(explicitKeys[1]) : null,
    });
  }

  return { byTable, notes };
}

/**
 * `"APIARY_INFORMATION (APIARYID (NUMBER), APIARY (STRING)); HIVE_INFORMATION (…)"`
 * Field names may contain dots and hyphens (`HOURLY_WEATHER.OBSID`,
 * `CITY-STATION_CITY`), so the split is paren-depth aware rather than `\w+`.
 */
function parseDatasets(
  raw: unknown,
  dimensional: ReturnType<typeof parseDimensionalModel>,
): DatasetTable[] {
  if (typeof raw !== "string" || !raw.trim()) return [];

  return splitTopLevel(raw, ";").map((entry) => {
    const { name, body } = splitNameAndBody(entry);
    const fields: DatasetField[] = splitTopLevel(body, ",").map((fieldEntry) => {
      const parsed = splitNameAndBody(fieldEntry);
      return {
        name: parsed.name || fieldEntry.trim(),
        type: parsed.body || "Unknown",
        isKey: looksLikeKey(parsed.name || fieldEntry.trim()),
      };
    });

    const classification = dimensional.byTable.get(name);
    return {
      name,
      fields,
      fieldCount: fields.length,
      keyCount: classification?.keys ?? fields.filter((f) => f.isKey).length,
      role: classification?.role ?? "Unclassified",
      roleReason: classification?.reason ?? "",
    };
  });
}

/** `"Found 1 subquery in query 3: // --- Source Part ---\n[WEATHER_STATIONS]:…"` */
function parseQueryComplexity(lines: string[]) {
  const findings: QueryFinding[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const match = line.match(/^Found\s+(\d+)\s+subquer(?:y|ies)\s+in\s+query\s+(\d+):\s*([\s\S]*)$/i);
    if (match) {
      findings.push({
        subqueryCount: Number(match[1]),
        index: Number(match[2]),
        snippet: match[3].trim(),
      });
    } else {
      notes.push(line);
    }
  }

  return { findings, notes: notes.sort((a, b) => (/^overall/i.test(a) ? 1 : /^overall/i.test(b) ? -1 : 0)) };
}

function parseConnections(raw: unknown): ConnectionInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(asRecord).map((entry) => {
    const c = entry as Record<string, unknown>;
    const text = (key: string) => (typeof c[key] === "string" ? (c[key] as string).trim() : "");
    return {
      name: text("name"),
      database: text("database"),
      driver: text("driver"),
      provider: text("provider"),
      server: text("server"),
      port: text("port"),
      schema: text("schema"),
      role: text("role"),
      warehouse: text("warehouse"),
      sourceConnector: text("source_connector"),
    };
  });
}

function parseKpis(raw: unknown): { count: number; kpis: KpiEntry[]; bySheet: KpiSheetGroup[] } {
  const record = asRecord(raw);
  const list = record && Array.isArray(record.kpis) ? (record.kpis as unknown[]) : [];

  const kpis: KpiEntry[] = list.filter(asRecord).map((item) => {
    const k = item as Record<string, unknown>;
    return {
      sheetName: typeof k.sheet_name === "string" ? k.sheet_name : "Unassigned",
      title: typeof k.title === "string" ? k.title : "Untitled",
      visualizationType: typeof k.visualization_type === "string" ? k.visualization_type : "kpi",
    };
  });

  const groups = new Map<string, KpiEntry[]>();
  for (const kpi of kpis) {
    const bucket = groups.get(kpi.sheetName);
    if (bucket) bucket.push(kpi);
    else groups.set(kpi.sheetName, [kpi]);
  }

  const declared = Number(record?.kpi_count);
  return {
    count: Number.isFinite(declared) ? declared : kpis.length,
    kpis,
    bySheet: Array.from(groups, ([sheetName, entries]) => ({ sheetName, kpis: entries })),
  };
}

/**
 * The payload has no `risk_mitigation` field (Tableau's does). What it does have
 * is a Power BI Replicability list covering the same topics as the Migration
 * Challenges list, so each challenge is paired with the replicability line that
 * discusses the same thing. Nothing is invented — an unmatched challenge gets "".
 */
const CHALLENGE_TOPICS: Array<[string, RegExp]> = [
  ["data-model", /data model/i],
  ["measures", /measure count/i],
  ["pages", /page count/i],
  ["expressions", /expression/i],
  ["unsupported", /unsupported data type/i],
  ["overall", /^overall/i],
];

function topicOf(line: string): string | null {
  for (const [topic, pattern] of CHALLENGE_TOPICS) {
    if (pattern.test(line)) return topic;
  }
  return null;
}

function pairChallenges(challengeLines: string[], replicabilityLines: string[]): ChallengePair[] {
  const summaryLine = replicabilityLines.find((line) => /replicable in power bi/i.test(line)) ?? "";

  return challengeLines.map((challenge) => {
    const topic = topicOf(challenge);
    const match = topic
      ? replicabilityLines.find((line) => topicOf(line) === topic && topic !== "overall")
      : undefined;
    return {
      challenge,
      replicabilityNote: match ?? (topic === "overall" ? summaryLine : ""),
    };
  });
}

/* ──────────────────────────────────────────────────────────────
   Entry point
   ────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────
   Structured-response parsers

   The backend used to describe these categories in prose, which the parsers
   above pick apart with regexes. It now returns structured objects, so the
   readers below take those directly. The prose parsers are kept as fallbacks
   for any deployment still emitting the old format.
   ────────────────────────────────────────────────────────────── */

type TableClassification = {
  role: "Fact" | "Dimension" | "Unclassified";
  reason: string;
  keys: number | null;
};

/** `{ fact_tables_identified: [...], dimension_tables_identified: [...] }` */
function readDimensionalModel(value: unknown): {
  byTable: Map<string, TableClassification>;
  notes: string[];
} {
  const record = asRecord(value);
  const byTable = new Map<string, TableClassification>();
  if (!record) return { byTable, notes: [] };

  for (const table of toStringArray(record.fact_tables_identified)) {
    byTable.set(table, { role: "Fact", reason: "Classified as a fact table", keys: null });
  }
  for (const table of toStringArray(record.dimension_tables_identified)) {
    byTable.set(table, { role: "Dimension", reason: "Classified as a dimension table", keys: null });
  }
  return { byTable, notes: details(record) };
}

/**
 * `{ datasets: [{ table_name, field_count, source_query, fields: [{ name, nature }] }] }`
 *
 * Fields carry no `isKey` flag at all in this shape (only `name`/`nature`), so
 * per-field key status can't be determined anymore -- every `isKey` below is
 * `false`/unknown rather than guessed from naming conventions. The table-level
 * `keyCount` doesn't need to guess, though: `metadata.metadata.data_model.tables[]`
 * states an authoritative `key_fields` count per table, passed in as `keyFieldsByTable`.
 */
function readDatasets(
  value: unknown,
  dimensional: { byTable: Map<string, TableClassification> },
  keyFieldsByTable: Map<string, number>,
): DatasetTable[] {
  const record = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(record?.datasets)
      ? record.datasets
      : Array.isArray(record?.tables)
        ? record.tables
        : [];

  return list.map((entry) => {
    const table = asRecord(entry) ?? {};
    const fields: DatasetField[] = (Array.isArray(table.fields) ? table.fields : []).map((raw) => {
      const field = asRecord(raw) ?? {};
      return {
        name: String(field.name ?? field.Name ?? ""),
        type: String(field.data_type ?? field.type ?? field.nature ?? field.qlik_nature ?? "Unknown"),
        isKey: Boolean(field.is_key || field.isKey || looksLikeKey(String(field.name ?? ""))),
      };
    });

    const name = String(table.table_name ?? table.name ?? "Unknown");
    const classification = dimensional.byTable.get(name);
    return {
      name,
      fields,
      fieldCount: Number(table.field_count ?? table.fieldCount) || fields.length,
      keyCount: keyFieldsByTable.get(name) ?? fields.filter((field) => field.isKey).length,
      role: classification?.role ?? "Unclassified",
      roleReason: classification?.reason ?? "",
    };
  });
}

function readConnections(value: unknown): ConnectionInfo[] {
  const record = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(record?.connections)
      ? record.connections
      : Array.isArray(record?.datasources)
        ? record.datasources
        : Array.isArray(asRecord(record?.connection_credentials)?.credentials)
          ? (asRecord(record?.connection_credentials)!.credentials as unknown[])
          : [];
  const text = (input: unknown) => (input == null ? "" : String(input));

  return list
    .filter((entry) => asRecord(entry)?.type !== "qix-datafiles.exe" && asRecord(entry)?.connector_type !== "qix-datafiles.exe")
    .map((entry) => {
      const connection = asRecord(entry) ?? {};
      const info = asRecord(connection.connection_details) ?? {};
      return {
        name: text(connection.name || connection.caption),
        database: text(info.database || connection.database),
        driver: text(info.driver || connection.connector_type || connection.type),
        provider: text(info.provider || connection.provider),
        server: text(info.server || connection.server),
        port: text(info.port || connection.port),
        schema: text(info.schema || connection.schema),
        role: text(info.role || connection.role),
        warehouse: text(info.warehouse || connection.warehouse),
        sourceConnector: text(info.source_connector) || text(connection.connector_type) || text(connection.type),
      };
    });
}

/**
 * A visual's `title` is usually a plain string, but a computed title (e.g. one
 * built with `Pick()`/`&` string concatenation) arrives as
 * `{ qStringExpression: { qExpr: "…" } }` instead. Rendering that object
 * directly would print "[object Object]"; the Qlik expression itself is the
 * best available label, so surface that.
 */
function extractVisualTitle(rawTitle: unknown, fallback: string): string {
  if (typeof rawTitle === "string" && rawTitle.trim()) return rawTitle.trim();
  const record = asRecord(rawTitle);
  const expr = asRecord(record?.qStringExpression)?.qExpr;
  if (typeof expr === "string" && expr.trim()) return expr.trim();
  return fallback;
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{3,8}$/i;

/**
 * Pulls literal hex colors out of one visual's `colours_used`. Qlik reports a
 * color as either a palette slot (`{ index: 6 }`, no way to resolve to an
 * actual color without theme data this payload never includes) or, when the
 * user picked a color outside the palette, `{ index: -1, color: "#xxxxxx" }`
 * -- only the second form is a real, renderable color. Checked in every shape
 * `colours_used` actually takes across chart types: a single-color field
 * (`paletteSingleColor`, KPI tiles), a single fill (`paletteColor`, most
 * other chart types), and a list of per-segment colors (`segments.
 * paletteColors[]`, conditional/measure-based coloring).
 */
function extractLiteralColors(coloursUsed: unknown): string[] {
  const record = asRecord(coloursUsed);
  if (!record) return [];

  const colors: string[] = [];
  const fromSlot = (slot: unknown) => {
    const s = asRecord(slot);
    if (!s) return;
    if (Number(s.index) === -1 && typeof s.color === "string" && HEX_COLOR_PATTERN.test(s.color)) {
      colors.push(s.color);
    }
  };

  fromSlot(record.paletteSingleColor);
  fromSlot(record.paletteColor);
  const segments = asRecord(record.segments)?.paletteColors;
  if (Array.isArray(segments)) segments.forEach(fromSlot);

  return colors;
}

/**
 * Every visualization comes from the top-level `visualizations` section: each
 * sheet lists a `visualizations` array, each tagged with a `chart_type` —
 * `kpi`, but also `barchart`, `linechart`, `piechart`, `filterpane`,
 * `sn-table`, `gauge`, `scatterplot`, `treemap`, `boxplot`, `qlik-variable-input`,
 * Qlik extension charts, etc. `mapQlikAssessment` derives the KPI-only subset
 * for Overview's "Total KPIs" tile by filtering this result, and the Visuals &
 * KPIs tab renders the full, unfiltered set.
 */
function readVisualizations(value: unknown): {
  visuals: KpiEntry[];
  bySheet: KpiSheetGroup[];
  customColors: CustomColorUsage[];
} {
  const record = asRecord(value);
  const sheets = Array.isArray(record?.sheets) ? record.sheets : [];
  const visuals: KpiEntry[] = [];
  const bySheet: KpiSheetGroup[] = [];
  const colorUsage = new Map<string, Set<string>>();

  for (const entry of sheets) {
    const sheet = asRecord(entry) ?? {};
    const sheetName = String(sheet.sheet_name ?? "Unnamed sheet");
    const cells = Array.isArray(sheet.visualizations) ? sheet.visualizations : [];

    const found = cells.map((raw) => {
      const cell = asRecord(raw) ?? {};
      // Cells carry an internal `visual_name` id; a human title is not always set.
      const fallback = String(cell.visual_name ?? "");
      const title = extractVisualTitle(cell.title, fallback);

      for (const color of extractLiteralColors(cell.colours_used)) {
        if (!colorUsage.has(color)) colorUsage.set(color, new Set());
        colorUsage.get(color)!.add(`${sheetName} / ${title}`);
      }

      return {
        sheetName,
        title,
        visualizationType: String(cell.chart_type ?? "Unknown"),
      };
    });

    if (found.length > 0) {
      visuals.push(...found);
      bySheet.push({ sheetName, kpis: found });
    }
  }

  const customColors: CustomColorUsage[] = Array.from(colorUsage, ([color, visualSet]) => ({
    color,
    visuals: Array.from(visualSet),
  }));

  return { visuals, bySheet, customColors };
}

/** `{ complex_operations: [...], power_query_recommendation, reasoning }` */
function readQueryComplexity(value: unknown): {
  findings: QueryFinding[];
  notes: string[];
} {
  const record = asRecord(value);
  const operations = toStringArray(record?.complex_operations);
  return {
    // The response names the operation classes rather than echoing script
    // excerpts, so there is no subquery count to report.
    findings: operations.map((snippet, position) => ({
      index: position + 1,
      subqueryCount: 0,
      snippet,
    })),
    notes: [
      ...toStringArray(record?.reasoning),
      ...(typeof record?.power_query_recommendation === "string"
        ? [record.power_query_recommendation]
        : []),
    ],
  };
}

/** `{ identified_challenges: [{ feature, description, powerbi_alternative }] }` */
function readChallenges(migration: unknown, powerBi: unknown): ChallengePair[] {
  const record = asRecord(migration);
  const list = Array.isArray(record?.identified_challenges)
    ? record.identified_challenges
    : [];

  if (list.length === 0) {
    // Older prose format: fall back to matching challenge text against the
    // replicability lines.
    return pairChallenges(details(migration), details(powerBi));
  }

  return list.map((entry) => {
    const item = asRecord(entry) ?? {};
    const feature = typeof item.feature === "string" ? item.feature : "";
    const description = typeof item.description === "string" ? item.description : "";
    return {
      challenge: feature && description ? `${feature}: ${description}` : feature || description,
      // Each challenge now states its own Power BI equivalent, so no text
      // matching against the replicability lines is needed.
      replicabilityNote:
        typeof item.powerbi_alternative === "string" ? item.powerbi_alternative : "",
    };
  });
}

/**
 * `{ dimension_count, dimensions: [...] }` / `{ measure_count, measures: [...] }`
 *
 * Master dimensions and master measures use the same envelope with different
 * key names, so one reader serves both. A dimension states its expression under
 * `field_defs` (an array, because a drill-down dimension has one entry per
 * level); a measure states it under `expression`.
 */
function readMasterItems(value: unknown, kind: "dimensions" | "measures"): MasterItem[] {
  const record = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(record?.[kind])
      ? (record[kind] as unknown[])
      : [];

  return list.map((raw) => {
    const item = asRecord(raw) ?? {};
    const fieldDefs = toStringArray(item.field_defs);
    return {
      name: String(item.name ?? item.title ?? item.measure_id ?? "Untitled"),
      expression:
        typeof item.expression === "string" && item.expression.trim()
          ? item.expression.trim()
          : fieldDefs.join(" | "),
      description: typeof item.description === "string" ? item.description : "",
      dataType: String(item.dataType ?? item.data_type ?? item.nature ?? item.qlik_nature ?? "Unknown"),
      tables: toStringArray(item.tables),
    };
  });
}

/** Top-level `section_access: { count, details: [{ table, fields, security_fields, reduction_fields, inline_data }] }` */
function readSectionAccess(value: unknown): SectionAccessRule[] {
  const record = asRecord(value);
  const list = Array.isArray(record?.details) ? (record.details as unknown[]) : [];

  return list.map((raw) => {
    const rule = asRecord(raw) ?? {};
    const rows = Array.isArray(rule.inline_data) ? rule.inline_data : [];
    return {
      table: typeof rule.table === "string" ? rule.table : "",
      fields: toStringArray(rule.fields),
      securityFields: toStringArray(rule.security_fields),
      reductionFields: toStringArray(rule.reduction_fields),
      rows: rows.filter(asRecord).map((row) => {
        const entry = row as Record<string, unknown>;
        return Object.fromEntries(
          Object.entries(entry).map(([key, cell]) => [key, cell == null ? "" : String(cell)]),
        );
      }),
    };
  });
}

/** Top-level `datasets.datasets[].source_query` -- the real per-table LOAD script. */
function readLoadScripts(value: unknown): LoadScript[] {
  const record = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(record?.datasets)
      ? record.datasets
      : Array.isArray(record?.tables)
        ? record.tables
        : [];
  return list
    .map((raw) => {
      const table = asRecord(raw) ?? {};
      return {
        tableName: String(table.table_name ?? table.name ?? "Unknown"),
        script:
          typeof table.load_statement === "string"
            ? table.load_statement.trim()
            : typeof table.source_query === "string"
              ? table.source_query.trim()
              : "",
      };
    })
    .filter((entry) => entry.script.length > 0);
}

/** Top-level `variables: { count, details: [...] }`. */
function readVariables(value: unknown): VariableItem[] {
  const record = asRecord(value);
  const list = Array.isArray(record?.details) ? (record.details as unknown[]) : [];
  return list.map((raw) => {
    const item = asRecord(raw) ?? {};
    return {
      name: String(item.name ?? "Untitled"),
      definition: typeof item.definition === "string" ? item.definition : "",
      description: typeof item.description === "string" ? item.description : "",
      scriptStatement: typeof item.script_statement === "string" ? item.script_statement : "",
      isReserved: Boolean(item.is_reserved),
      tags: toStringArray(item.tags),
    };
  });
}

/** Top-level `bookmarks: { count, details: [...] }`. */
function readBookmarks(value: unknown): BookmarkItem[] {
  const record = asRecord(value);
  const list = Array.isArray(record?.details) ? (record.details as unknown[]) : [];
  return list.map((raw) => {
    const item = asRecord(raw) ?? {};
    return {
      title: String(item.title ?? "Untitled"),
      description: typeof item.description === "string" ? item.description : "",
      sheetId: String(item.sheet_id ?? ""),
      creationDate: typeof item.creation_date === "string" ? item.creation_date : "",
      isPublic: Boolean(item.is_public),
    };
  });
}

function readAppMetadata(value: unknown): {
  ownerName: string;
  ownerEmail: string;
  spaceName: string;
  lastModified: string;
  lastReloadTime: string;
  createdDate: string;
  appFileSizeBytes: number;
  privileges: string[];
  keyFieldsByTable: Map<string, number>;
} {
  const outer = asRecord(value);
  const appObj = asRecord(outer?.app) ?? {};
  const meta = asRecord(outer?.metadata) ?? appObj;
  const resourceSize = asRecord(meta.resource_size);
  const dataModel = asRecord(meta.data_model);
  const tables = Array.isArray(dataModel?.tables) ? dataModel.tables : [];

  const keyFieldsByTable = new Map<string, number>();
  for (const raw of tables) {
    const table = asRecord(raw);
    if (!table || typeof table.name !== "string") continue;
    keyFieldsByTable.set(table.name, Number(table.key_fields) || 0);
  }

  const privileges = Array.isArray(meta.privileges)
    ? meta.privileges.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    : [];

  return {
    ownerName: typeof meta.owner_name === "string" ? meta.owner_name : (typeof appObj.owner_name === "string" ? appObj.owner_name : ""),
    ownerEmail: typeof meta.owner_email === "string" ? meta.owner_email : (typeof appObj.owner_email === "string" ? appObj.owner_email : ""),
    spaceName: typeof meta.space_name === "string" ? meta.space_name : (typeof appObj.space_name === "string" ? appObj.space_name : ""),
    lastModified: typeof meta.last_modified === "string" ? meta.last_modified : (typeof appObj.last_modified === "string" ? appObj.last_modified : ""),
    lastReloadTime: typeof meta.last_reload_time === "string" ? meta.last_reload_time : (typeof appObj.last_reload_time === "string" ? appObj.last_reload_time : ""),
    createdDate: typeof meta.created_date === "string" ? meta.created_date : (typeof appObj.created_date === "string" ? appObj.created_date : ""),
    appFileSizeBytes: Number(resourceSize?.appFile) || 0,
    privileges,
    keyFieldsByTable,
  };
}

export function mapQlikAssessment(data: AssessmentData | null | undefined): QlikAssessment {
  const source = unwrapAssessment(data);
  const read = makeReader(source);

  const complexity = read("Complexity");
  const criticality = read("Business Criticality");
  const documentation = read("Metric Documentation");
  const sensitivity = read("Data Sensitivity");
  const volume = read("Data Volume");
  const migration = read("Migration Challenges");
  const query = read("Query Complexity");
  const powerBiRaw = read("Power BI Replicability");
  const unsupportedFeatures = toStringArray(asRecord(powerBiRaw)?.unsupported_qlik_features);
  const unsupported =
    read("Unsupported Data Types") ??
    (unsupportedFeatures.length > 0
      ? { status: `${unsupportedFeatures.length} feature${unsupportedFeatures.length > 1 ? "s" : ""}`, details: unsupportedFeatures }
      : { status: "No Issues", details: [] });
  const dataModelRaw = read("Data Model");
  const dimensionalRaw = read("Dimensional Model");

  const sourceRecord = source as unknown as Record<string, unknown> | null;
  const appObj = asRecord(sourceRecord?.app) ?? {};
  const screenshotsRaw = asRecord(sourceRecord?.screenshots);
  const appMetadata = readAppMetadata(sourceRecord);

  const dimensional = readDimensionalModel(dimensionalRaw);
  const datasets = readDatasets(sourceRecord?.datasets || sourceRecord?.tables, dimensional, appMetadata.keyFieldsByTable);
  const loadScripts = readLoadScripts(sourceRecord?.datasets || sourceRecord?.tables);

  const customSqlRaw = asRecord(sourceRecord?.custom_sql);
  const rawCustomSqlTotal =
    sourceRecord?.total_custom_sqls ?? customSqlRaw?.total_custom_sqls ?? customSqlRaw?.count ?? null;
  const customSqlCount =
    typeof rawCustomSqlTotal === "number"
      ? rawCustomSqlTotal
      : loadScripts.filter((s) => /\bSQL\s+SELECT\b/i.test(s.script)).length;
  const queryComplexity = readQueryComplexity(query);
  const visualizationData = readVisualizations(sourceRecord?.visualizations);
  const kpiOnly = visualizationData.visuals.filter((v) => /^kpi$/i.test(v.visualizationType));
  const kpiOnlyBySheet = visualizationData.bySheet
    .map((group) => ({
      sheetName: group.sheetName,
      kpis: group.kpis.filter((k) => /^kpi$/i.test(k.visualizationType)),
    }))
    .filter((group) => group.kpis.length > 0);
  const connections = readConnections(sourceRecord?.connections || sourceRecord?.datasources || sourceRecord?.connection_credentials);
  const masterDimensions = readMasterItems(sourceRecord?.dimensions, "dimensions");
  const masterMeasures = readMasterItems(sourceRecord?.measures, "measures");
  const sectionAccess = readSectionAccess(sourceRecord?.section_access);
  const variables = readVariables(sourceRecord?.variables);
  const bookmarks = readBookmarks(sourceRecord?.bookmarks);

  const complexityRecord = asRecord(complexity);
  const volumeRecord = asRecord(volume);
  const sensitivityRecord = asRecord(sensitivity);
  const dataModelRecord = asRecord(dataModelRaw);
  const migrationRecord = asRecord(migration);
  const text = (value: unknown): string =>
    typeof value === "string" && value.trim() ? value.trim() : "";

  const dataModelStats = (() => {
    const record = asRecord(dataModelRaw);
    if (typeof record?.stats === "string") return record.stats;
    // No `stats` line in the structured response, so derive the same
    // "N tables, N fields, N keys" summary the UI expects from the datasets.
    if (datasets.length === 0) return "";
    const fields = datasets.reduce((sum, table) => sum + table.fieldCount, 0);
    const keys = datasets.reduce((sum, table) => sum + table.keyCount, 0);
    return `${datasets.length} tables, ${fields} fields, ${keys} keys`;
  })();
  /** `"6 tables, 40 fields, 11 keys, None"` — the bot's own totals win over our sums. */
  const statNumber = (label: string): number | null => {
    const match = dataModelStats.match(new RegExp(`(\\d+)\\s+${label}`, "i"));
    return match ? Number(match[1]) : null;
  };

  const powerBiRecommendation = headline(powerBiRaw);
  const powerBiTone: Tone = /^not\b/i.test(powerBiRecommendation)
    ? "danger"
    : /partial/i.test(powerBiRecommendation)
      ? "warning"
      : /replicable/i.test(powerBiRecommendation)
        ? "success"
        : "informative";

  const rating = (
    key: string,
    label: string,
    value: unknown,
    scale: Record<string, Tone> | ((reading: string) => Tone),
  ): RatingCategory => {
    const reading = headline(value);
    return {
      key,
      label,
      value: reading,
      details: details(value),
      tone: typeof scale === "function" ? scale(reading) : (scale[reading.toLowerCase()] ?? "informative"),
    };
  };

  return {
    reportName: (appObj?.app_name as string) || (sourceRecord?.app_name as string) || source?.report_name || "Unknown Report",
    status: source?.status || "unknown",
    fileType: headline(read("File Type")),

    // `total_sheets` sits at the top level now, alongside `total_tables`/
    // `total_fields`/etc.; "Total Pages" in `results[]` reports the same
    // number and stays as a fallback for older payloads.
    totalPages: Number(sourceRecord?.total_sheets ?? read("Total Sheets") ?? read("Total Pages")) || 0,
    kpiCount: kpiOnly.length,
    kpis: kpiOnly,
    kpisBySheet: kpiOnlyBySheet,
    sheetsWithKpis: kpiOnlyBySheet.length,

    visuals: visualizationData.visuals,
    visualsBySheet: visualizationData.bySheet,
    visualCount: visualizationData.visuals.length,
    sheetsWithVisuals: visualizationData.bySheet.length,
    customColors: visualizationData.customColors,

    datasets,
    datasetCount: statNumber("tables") ?? datasets.length,
    totalFields: statNumber("fields") ?? datasets.reduce((sum, d) => sum + d.fieldCount, 0),
    totalKeys: statNumber("keys") ?? datasets.reduce((sum, d) => sum + d.keyCount, 0),
    factCount: datasets.filter((d) => d.role === "Fact").length,
    dimensionCount: datasets.filter((d) => d.role === "Dimension").length,

    dataModelStructure: headline(dataModelRaw),
    dataModelStats,
    dataModelDetails: details(dataModelRaw),
    dimensionalModelType: headline(dimensionalRaw),
    dimensionalNotes: dimensional.notes,

    connections,
    databaseName: connections[0]?.driver || connections[0]?.name || "Unknown",

    queryFindings: queryComplexity.findings,
    queryNotes: queryComplexity.notes,

    screenshotCount: Number(screenshotsRaw?.count) || 0,
    screenshotDetails: toStringArray(screenshotsRaw?.details),
    screenshots: screenshotsRaw && Array.isArray(screenshotsRaw.screenshots) ? screenshotsRaw.screenshots : [],

    powerBi: {
      recommendation: powerBiRecommendation,
      details: details(powerBiRaw),
      tone: powerBiTone,
    },

    ratings: [
      rating("complexity", "Complexity", complexity, RISK_TONE),
      rating("criticality", "Business Criticality", criticality, RISK_TONE),
      rating("documentation", "Metric Documentation", documentation, QUALITY_TONE),
      rating("sensitivity", "Data Sensitivity", sensitivity, RISK_TONE),
      rating("volume", "Data Volume", volume, RISK_TONE),
      rating("migration", "Migration Challenges", migration, RISK_TONE),
      rating("query", "Query Complexity", query, RISK_TONE),
      rating("unsupported", "Unsupported Data Types", unsupported, (reading) =>
        /no issues|none/i.test(reading) ? "success" : "warning",
      ),
    ],

    challenges: readChallenges(migration, powerBiRaw),

    // `ai_summary` sits at the top level of the document, not inside `results`,
    // so the category reader never saw it.
    aiSummary: toStringArray((source as Record<string, unknown> | null)?.ai_summary),

    masterDimensions,
    masterMeasures,
    // `total_dimensions`/`total_measures` (top-level, or nested in the
    // `dimensions`/`measures` sections themselves) replaced the old
    // `dimension_count`/`measure_count` keys.
    masterDimensionCount: Number(sourceRecord?.total_dimensions) || masterDimensions.length,
    masterMeasureCount: Number(sourceRecord?.total_measures) || masterMeasures.length,

    sectionAccess,
    hasSectionAccess: sectionAccess.length > 0,

    loadScripts,
    customSqlCount,

    variables,
    bookmarks,
    variableCount: Number(sourceRecord?.total_variables) || variables.length,
    bookmarkCount: Number(sourceRecord?.total_bookmarks) || bookmarks.length,

    ownerName: appMetadata.ownerName,
    ownerEmail: appMetadata.ownerEmail,
    spaceName: appMetadata.spaceName,
    lastModified: appMetadata.lastModified,
    lastReloadTime: appMetadata.lastReloadTime,
    createdDate: appMetadata.createdDate,
    appFileSizeBytes: appMetadata.appFileSizeBytes,
    privileges: appMetadata.privileges,

    complexityScore: Number.isFinite(Number(complexityRecord?.complexity_score))
      ? Number(complexityRecord?.complexity_score)
      : null,
    reworkEffort: text(migrationRecord?.estimated_rework_effort),
    piiFields: toStringArray(sensitivityRecord?.pii_fields_detected),
    complianceRisk: text(sensitivityRecord?.compliance_risk),
    syntheticKeysDetected: Boolean(dataModelRecord?.synthetic_keys_detected),
    circularReferencesDetected: Boolean(dataModelRecord?.circular_references_detected),
    rowCountEstimate: text(volumeRecord?.estimated_row_count),
    storageModeRecommendation: text(volumeRecord?.powerbi_mode_recommendation),

    raw: source,
  };
}
