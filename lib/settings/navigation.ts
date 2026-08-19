/**
 * Single source of truth for the Administration Center navigation.
 *
 * Every section in the admin menu is declared exactly once here. The navigation
 * rail, the section router and the settings search all read from this registry,
 * so adding a section is a one-line change rather than an edit in three places.
 */

/** Stable identifier for a settings section. Used in URLs and persisted state. */
export type SettingsSectionId =
  // Platform
  | "general"
  | "appearance"
  | "workspace"
  | "migration"
  // AI
  | "ai-providers"
  | "ai-models"
  | "ai-agents"
  // Integrations
  //
  // One section rather than one per platform. Every connector is configured
  // through the same registry-driven framework, so splitting the menu by vendor
  // would add an entry for each future connector without adding any capability
  // — and would reintroduce exactly the per-platform configuration screens the
  // Administration Center exists to consolidate.
  | "integrations"
  | "azure"
  // Infrastructure
  | "authentication"
  | "security"
  | "api"
  | "environment"
  | "storage"
  // Operations
  | "notifications"
  | "monitoring"
  | "reports"
  | "logs"
  | "audit"
  // Governance
  | "feature-flags"
  | "users"
  | "roles"
  | "about";

export type SettingsGroupId =
  | "platform"
  | "ai"
  | "integrations"
  | "infrastructure"
  | "operations"
  | "governance";

/**
 * Whether a section is wired up yet.
 *
 * `planned` sections still appear in the navigation — the menu is the agreed
 * shape of the admin centre — but render an explicit "not yet configured"
 * state instead of pretending to save. This keeps the UI honest.
 */
export type SectionStatus = "available" | "planned";

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  /** Short description shown under the section heading. */
  description: string;
  group: SettingsGroupId;
  status: SectionStatus;
  /** Extra terms that should match this section in settings search. */
  keywords: string[];
}

export interface SettingsGroup {
  id: SettingsGroupId;
  label: string;
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  { id: "platform", label: "Platform" },
  { id: "ai", label: "AI" },
  { id: "integrations", label: "Integrations" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "operations", label: "Operations" },
  { id: "governance", label: "Governance" },
] as const;

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  {
    id: "general",
    label: "General",
    description: "Company identity, platform naming, language, timezone and date formatting.",
    group: "platform",
    status: "available",
    keywords: ["company", "logo", "language", "timezone", "date", "version"],
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Theme, accent colour, density and motion preferences for this platform.",
    group: "platform",
    status: "available",
    keywords: ["theme", "dark", "light", "accent", "font", "compact", "density", "animation"],
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Default workspace, restore behaviour and dashboard layout.",
    group: "platform",
    status: "available",
    keywords: ["qlik", "tableau", "default", "restore", "layout", "dashboard"],
  },

  {
    id: "migration",
    label: "Migration",
    description: "Pipeline behaviour and the deployment target for generated assets.",
    group: "platform",
    status: "available",
    keywords: ["pipeline", "interactive", "data layer", "deployment", "git", "azure devops", "fabric"],
  },

  {
    id: "ai-providers",
    label: "AI Providers",
    description: "Credentials and connection settings for each supported model provider.",
    group: "ai",
    status: "planned",
    keywords: ["openai", "azure", "anthropic", "claude", "gemini", "ollama", "groq", "mistral"],
  },
  {
    id: "ai-models",
    label: "AI Models",
    description: "Discovered models and per-workflow model assignment.",
    group: "ai",
    status: "planned",
    keywords: ["model", "deployment", "temperature", "tokens", "assignment"],
  },
  {
    id: "ai-agents",
    label: "AI Agents",
    description: "Semantic Kernel agent configuration for the migration pipeline.",
    group: "ai",
    status: "planned",
    keywords: ["agent", "semantic kernel", "pipeline", "orchestration"],
  },

  {
    id: "integrations",
    label: "Integrations",
    description:
      "Every connected platform in one place. Configure each connector once — credentials are verified and metadata discovered automatically.",
    group: "integrations",
    status: "available",
    // Vendor names are keywords rather than sections, so searching "tableau"
    // still lands the administrator in the right place.
    keywords: [
      "connector",
      "qlik",
      "tenant",
      "spaces",
      "apps",
      "tableau",
      "pat",
      "site",
      "projects",
      "workbooks",
      "fabric",
      "lakehouse",
      "warehouse",
      "capacity",
      "power bi",
      "snowflake",
      "databricks",
      "oracle",
      "sql server",
      "sap",
      "looker",
      "postgresql",
      "mysql",
      "bigquery",
    ],
  },
  {
    id: "azure",
    label: "Azure",
    description: "Subscription, resource group, Key Vault, storage and app services.",
    group: "integrations",
    status: "planned",
    keywords: ["azure", "subscription", "key vault", "storage", "functions"],
  },

  {
    id: "authentication",
    label: "Authentication",
    description: "MSAL sign-in status, tenant, roles, groups and token lifetime.",
    group: "infrastructure",
    status: "planned",
    keywords: ["msal", "sso", "token", "roles", "groups", "session"],
  },
  {
    id: "security",
    label: "Security",
    description: "Content security policy, headers, cookies and secret handling.",
    group: "infrastructure",
    status: "planned",
    keywords: ["csp", "xss", "csrf", "cookies", "headers", "jwt", "secrets"],
  },
  {
    id: "api",
    label: "API",
    description: "Downstream API inventory with health, latency, retry and timeout.",
    group: "infrastructure",
    status: "planned",
    keywords: ["api", "latency", "health", "retry", "timeout", "ping"],
  },
  {
    id: "environment",
    label: "Environment",
    description: "Runtime configuration that would otherwise live in .env files.",
    group: "infrastructure",
    status: "planned",
    keywords: ["env", "url", "database", "connection", "runtime"],
  },
  {
    id: "storage",
    label: "Storage",
    description: "Blob and OneLake storage accounts, containers and retention.",
    group: "infrastructure",
    status: "planned",
    keywords: ["storage", "blob", "onelake", "container", "retention"],
  },

  {
    id: "notifications",
    label: "Notifications",
    description: "Delivery channels and per-event notification rules.",
    group: "operations",
    status: "planned",
    keywords: ["email", "teams", "webhook", "alerts"],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Pipeline telemetry, polling intervals and health thresholds.",
    group: "operations",
    status: "planned",
    keywords: ["telemetry", "metrics", "polling", "health"],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Report generation defaults, branding and export formats.",
    group: "operations",
    status: "planned",
    keywords: ["pdf", "export", "branding", "report"],
  },
  {
    id: "logs",
    label: "Logs",
    description: "Log level, retention window and log forwarding destinations.",
    group: "operations",
    status: "planned",
    keywords: ["log", "level", "retention", "forwarding"],
  },
  {
    id: "audit",
    label: "Audit",
    description: "Immutable record of configuration changes and who made them.",
    group: "operations",
    status: "planned",
    keywords: ["audit", "history", "compliance", "who"],
  },

  {
    id: "feature-flags",
    label: "Feature Flags",
    description: "Toggle platform capabilities without a redeploy.",
    group: "governance",
    status: "planned",
    keywords: ["flags", "toggle", "rollout", "experiment"],
  },
  {
    id: "users",
    label: "Users",
    description: "Directory of platform users and their access.",
    group: "governance",
    status: "planned",
    keywords: ["users", "people", "directory", "access"],
  },
  {
    id: "roles",
    label: "Roles",
    description: "Role definitions and permission assignment.",
    group: "governance",
    status: "planned",
    keywords: ["roles", "rbac", "permissions"],
  },
  {
    id: "about",
    label: "About",
    description: "Build version, runtime information and platform provenance.",
    group: "governance",
    status: "available",
    keywords: ["version", "build", "release", "support"],
  },
] as const;

/** The section shown when the admin centre is opened without an explicit target. */
export const DEFAULT_SECTION_ID: SettingsSectionId = "general";

export function getSection(id: SettingsSectionId): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id);
}

export function getSectionsForGroup(groupId: SettingsGroupId): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) => section.group === groupId);
}

/**
 * Case-insensitive search across section labels, descriptions and keywords.
 * An empty query returns every section so the caller can render the full menu.
 */
export function searchSections(query: string): SettingsSection[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...SETTINGS_SECTIONS];

  return SETTINGS_SECTIONS.filter((section) => {
    const haystack = [section.label, section.description, ...section.keywords]
      .join(" ")
      .toLowerCase();
    return haystack.includes(trimmed);
  });
}
