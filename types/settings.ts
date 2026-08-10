/**
 * Domain model for the Enterprise Administration Center.
 *
 * These types describe the persisted platform settings document. Anything an
 * administrator can change from the UI lives here, so that no operator ever has
 * to hand-edit a .env file to reconfigure the platform.
 *
 * Secret values (API keys, PATs, connection strings) are intentionally NOT part
 * of this document. They are write-only from the client and are stored by the
 * server behind a secret reference — see `lib/settings/secrets.ts`.
 */

// ---------------------------------------------------------------------------
// Appearance primitives
// ---------------------------------------------------------------------------

/** Theme selection. "system" follows the OS `prefers-color-scheme`. */
export type ThemeMode = "light" | "dark" | "system";

/** Resolved theme actually handed to the Fluent UI provider. */
export type ResolvedTheme = "light" | "dark";

export type AccentColor =
  | "blue"
  | "teal"
  | "green"
  | "purple"
  | "magenta"
  | "orange"
  | "red";

export type FontSize = "small" | "medium" | "large";

export type SidebarStyle = "expanded" | "compact" | "overlay";

export type CardStyle = "elevated" | "outline" | "flat";

export type DashboardDensity = "comfortable" | "cozy" | "compact";

export type DashboardLayout = "grid" | "list" | "detail";

/** The two migration workspaces the unified platform supports. */
export type WorkspaceKind = "qlik" | "tableau";

// ---------------------------------------------------------------------------
// Section payloads
// ---------------------------------------------------------------------------

export interface GeneralSettings {
  companyName: string;
  platformName: string;
  /** Data URI or served URL for the tenant logo. Empty string means "use default". */
  logoUrl: string;
  language: string;
  /** IANA timezone identifier, e.g. "Australia/Sydney". */
  timezone: string;
  /** date-fns compatible format string. */
  dateFormat: string;
}

export interface AppearanceSettings {
  themeMode: ThemeMode;
  accentColor: AccentColor;
  fontSize: FontSize;
  compactMode: boolean;
  animationsEnabled: boolean;
  sidebarStyle: SidebarStyle;
  cardStyle: CardStyle;
  dashboardDensity: DashboardDensity;
}

export interface WorkspaceSettings {
  defaultWorkspace: WorkspaceKind;
  rememberLastWorkspace: boolean;
  autoRestoreWorkspace: boolean;
  /** Persisted only when `rememberLastWorkspace` is enabled. */
  lastWorkspace: WorkspaceKind | null;
  dashboardLayout: DashboardLayout;
}

// ---------------------------------------------------------------------------
// Root document
// ---------------------------------------------------------------------------

/**
 * The persisted settings document.
 *
 * `schemaVersion` lets the server migrate older documents forward without
 * losing administrator configuration.
 */
export interface PlatformSettings {
  schemaVersion: number;
  general: GeneralSettings;
  appearance: AppearanceSettings;
  workspace: WorkspaceSettings;
}

/** A deep-partial patch used by PATCH-style updates. */
export type PlatformSettingsPatch = {
  [K in keyof Omit<PlatformSettings, "schemaVersion">]?: Partial<PlatformSettings[K]>;
};

/**
 * What the settings API returns. `applicationVersion` is derived server-side
 * from package.json rather than stored, so it can never drift from the build.
 */
export interface PlatformSettingsResponse {
  settings: PlatformSettings;
  applicationVersion: string;
  /** ISO timestamp of the last successful write, or null if never written. */
  updatedAt: string | null;
}
