/**
 * Default values and selectable options for the Administration Center.
 *
 * Defaults are deliberately neutral: no customer name, no endpoint and no
 * credential is baked in here. A fresh deployment starts from these values and
 * the administrator configures the rest from the UI.
 */

import type {
  AccentColor,
  AppearanceSettings,
  CardStyle,
  DashboardDensity,
  DashboardLayout,
  FontSize,
  GeneralSettings,
  PlatformSettings,
  SidebarStyle,
  ThemeMode,
  WorkspaceKind,
  WorkspaceSettings,
} from "@/types/settings";

/**
 * Bump when a breaking change is made to the persisted shape, and add a
 * migration step in `lib/settings/repository.ts`.
 */
export const SETTINGS_SCHEMA_VERSION = 1;

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  companyName: "",
  platformName: "Switchblade Unified Platform",
  logoUrl: "",
  language: "en-AU",
  timezone: "UTC",
  dateFormat: "dd MMM yyyy, HH:mm",
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  themeMode: "system",
  accentColor: "blue",
  fontSize: "medium",
  compactMode: false,
  animationsEnabled: true,
  sidebarStyle: "expanded",
  cardStyle: "elevated",
  dashboardDensity: "comfortable",
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultWorkspace: "tableau",
  rememberLastWorkspace: true,
  autoRestoreWorkspace: true,
  lastWorkspace: null,
  dashboardLayout: "grid",
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  general: DEFAULT_GENERAL_SETTINGS,
  appearance: DEFAULT_APPEARANCE_SETTINGS,
  workspace: DEFAULT_WORKSPACE_SETTINGS,
};

// ---------------------------------------------------------------------------
// Selectable options (consumed by the settings UI dropdowns)
// ---------------------------------------------------------------------------

export interface SettingOption<T extends string> {
  value: T;
  label: string;
  /** Optional helper text rendered beneath the option label. */
  hint?: string;
}

export const THEME_MODE_OPTIONS: readonly SettingOption<ThemeMode>[] = [
  { value: "light", label: "Light", hint: "Always use the light theme" },
  { value: "dark", label: "Dark", hint: "Always use the dark theme" },
  { value: "system", label: "System", hint: "Follow the operating system setting" },
] as const;

export const ACCENT_COLOR_OPTIONS: readonly SettingOption<AccentColor>[] = [
  { value: "blue", label: "Blue" },
  { value: "teal", label: "Teal" },
  { value: "green", label: "Green" },
  { value: "purple", label: "Purple" },
  { value: "magenta", label: "Magenta" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
] as const;

/** Hex swatches used to preview each accent in the UI. */
export const ACCENT_COLOR_SWATCHES: Record<AccentColor, string> = {
  blue: "#0f6cbd",
  teal: "#038387",
  green: "#107c10",
  purple: "#5c2e91",
  magenta: "#bf0077",
  orange: "#d83b01",
  red: "#c50f1f",
};

export const FONT_SIZE_OPTIONS: readonly SettingOption<FontSize>[] = [
  { value: "small", label: "Small", hint: "Fits more on screen" },
  { value: "medium", label: "Medium", hint: "Recommended" },
  { value: "large", label: "Large", hint: "Easier to read" },
] as const;

/** Root font size in pixels for each option, applied to the document element. */
export const FONT_SIZE_SCALE: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

export const SIDEBAR_STYLE_OPTIONS: readonly SettingOption<SidebarStyle>[] = [
  { value: "expanded", label: "Expanded", hint: "Show icons and labels" },
  { value: "compact", label: "Compact", hint: "Icons only" },
  { value: "overlay", label: "Overlay", hint: "Float above content when opened" },
] as const;

export const CARD_STYLE_OPTIONS: readonly SettingOption<CardStyle>[] = [
  { value: "elevated", label: "Elevated", hint: "Cards cast a shadow" },
  { value: "outline", label: "Outline", hint: "Cards use a border only" },
  { value: "flat", label: "Flat", hint: "No border or shadow" },
] as const;

export const DASHBOARD_DENSITY_OPTIONS: readonly SettingOption<DashboardDensity>[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "cozy", label: "Cozy" },
  { value: "compact", label: "Compact" },
] as const;

export const DASHBOARD_LAYOUT_OPTIONS: readonly SettingOption<DashboardLayout>[] = [
  { value: "grid", label: "Grid", hint: "Tiles arranged in a responsive grid" },
  { value: "list", label: "List", hint: "One row per item" },
  { value: "detail", label: "Detail", hint: "Expanded cards with more metrics" },
] as const;

export const WORKSPACE_OPTIONS: readonly SettingOption<WorkspaceKind>[] = [
  { value: "tableau", label: "Tableau" },
  { value: "qlik", label: "Qlik" },
] as const;

export const LANGUAGE_OPTIONS: readonly SettingOption<string>[] = [
  { value: "en-AU", label: "English (Australia)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "en-US", label: "English (United States)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German (Germany)" },
  { value: "es-ES", label: "Spanish (Spain)" },
  { value: "ja-JP", label: "Japanese (Japan)" },
] as const;

/** date-fns format strings paired with a human-readable sample. */
export const DATE_FORMAT_OPTIONS: readonly SettingOption<string>[] = [
  { value: "dd MMM yyyy, HH:mm", label: "31 Dec 2026, 14:30" },
  { value: "dd/MM/yyyy HH:mm", label: "31/12/2026 14:30" },
  { value: "MM/dd/yyyy hh:mm a", label: "12/31/2026 02:30 PM" },
  { value: "yyyy-MM-dd HH:mm", label: "2026-12-31 14:30" },
  { value: "EEEE, d MMMM yyyy", label: "Thursday, 31 December 2026" },
] as const;
