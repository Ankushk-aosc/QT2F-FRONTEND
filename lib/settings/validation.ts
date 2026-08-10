/**
 * Pure validation and normalisation for the platform settings document.
 *
 * Deliberately free of I/O and of `server-only`, so the rules that decide what
 * is allowed into storage can be unit tested directly.
 *
 * The guiding rule: the client is untrusted. Every field is checked against its
 * allowed values and falls back to the current value rather than being stored
 * raw, so a malformed or hostile payload can never corrupt configuration.
 */

import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
} from "./defaults";
import type {
  AppearanceSettings,
  GeneralSettings,
  PlatformSettings,
  PlatformSettingsPatch,
  WorkspaceSettings,
} from "@/types/settings";

export const THEME_MODES = ["light", "dark", "system"] as const;
export const ACCENT_COLORS = [
  "blue",
  "teal",
  "green",
  "purple",
  "magenta",
  "orange",
  "red",
] as const;
export const FONT_SIZES = ["small", "medium", "large"] as const;
export const SIDEBAR_STYLES = ["expanded", "compact", "overlay"] as const;
export const CARD_STYLES = ["elevated", "outline", "flat"] as const;
export const DASHBOARD_DENSITIES = ["comfortable", "cozy", "compact"] as const;
export const DASHBOARD_LAYOUTS = ["grid", "list", "detail"] as const;
export const WORKSPACE_KINDS = ["qlik", "tableau"] as const;

/** Maximum size of a logo data URI, ~1 MB of base64. */
export const MAX_LOGO_DATA_URI_LENGTH = 1_400_000;

export function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function pickString(value: unknown, fallback: string, maxLength = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength);
}

export function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * A logo may be a base64 image data URI or an absolute http(s) URL.
 *
 * Anything else is rejected. This value is rendered as an image source, so
 * allowing `javascript:` or similar would be an injection vector.
 */
export function pickLogoUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const isDataUri = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(
    trimmed,
  );
  const isHttpUrl = /^https?:\/\/\S+$/i.test(trimmed);

  if (!isDataUri && !isHttpUrl) return fallback;
  return trimmed.length <= MAX_LOGO_DATA_URI_LENGTH ? trimmed : fallback;
}

/** Accepts any IANA zone the runtime recognises, rather than a fixed list. */
export function pickTimezone(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const candidate = value.trim();
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return fallback;
  }
}

export function sanitiseGeneral(
  input: Partial<GeneralSettings> | undefined,
  current: GeneralSettings,
): GeneralSettings {
  if (!input) return current;
  return {
    companyName: pickString(input.companyName, current.companyName, 120),
    platformName:
      pickString(input.platformName, current.platformName, 120) ||
      DEFAULT_GENERAL_SETTINGS.platformName,
    logoUrl: pickLogoUrl(input.logoUrl, current.logoUrl),
    language: pickString(input.language, current.language, 20),
    timezone: pickTimezone(input.timezone, current.timezone),
    dateFormat: pickString(input.dateFormat, current.dateFormat, 40),
  };
}

export function sanitiseAppearance(
  input: Partial<AppearanceSettings> | undefined,
  current: AppearanceSettings,
): AppearanceSettings {
  if (!input) return current;
  return {
    themeMode: pickEnum(input.themeMode, THEME_MODES, current.themeMode),
    accentColor: pickEnum(input.accentColor, ACCENT_COLORS, current.accentColor),
    fontSize: pickEnum(input.fontSize, FONT_SIZES, current.fontSize),
    compactMode: pickBoolean(input.compactMode, current.compactMode),
    animationsEnabled: pickBoolean(input.animationsEnabled, current.animationsEnabled),
    sidebarStyle: pickEnum(input.sidebarStyle, SIDEBAR_STYLES, current.sidebarStyle),
    cardStyle: pickEnum(input.cardStyle, CARD_STYLES, current.cardStyle),
    dashboardDensity: pickEnum(
      input.dashboardDensity,
      DASHBOARD_DENSITIES,
      current.dashboardDensity,
    ),
  };
}

export function sanitiseWorkspace(
  input: Partial<WorkspaceSettings> | undefined,
  current: WorkspaceSettings,
): WorkspaceSettings {
  if (!input) return current;

  // `lastWorkspace` is nullable, so an explicit null must clear it while an
  // absent key leaves the stored value alone.
  const lastWorkspace =
    input.lastWorkspace === null
      ? null
      : input.lastWorkspace === undefined
        ? current.lastWorkspace
        : pickEnum(input.lastWorkspace, WORKSPACE_KINDS, current.lastWorkspace ?? "tableau");

  return {
    defaultWorkspace: pickEnum(input.defaultWorkspace, WORKSPACE_KINDS, current.defaultWorkspace),
    rememberLastWorkspace: pickBoolean(input.rememberLastWorkspace, current.rememberLastWorkspace),
    autoRestoreWorkspace: pickBoolean(input.autoRestoreWorkspace, current.autoRestoreWorkspace),
    lastWorkspace,
    dashboardLayout: pickEnum(input.dashboardLayout, DASHBOARD_LAYOUTS, current.dashboardLayout),
  };
}

/** Applies a client patch on top of the current document, validating as it goes. */
export function applyPatch(
  current: PlatformSettings,
  patch: PlatformSettingsPatch,
): PlatformSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    general: sanitiseGeneral(patch.general, current.general),
    appearance: sanitiseAppearance(patch.appearance, current.appearance),
    workspace: sanitiseWorkspace(patch.workspace, current.workspace),
  };
}

/**
 * Brings a stored document up to the current schema version.
 *
 * Unknown or older documents are merged onto the defaults, so an administrator
 * never loses configuration when the schema moves forward.
 */
export function migrateSettings(raw: unknown): PlatformSettings {
  const candidate = (raw ?? {}) as Partial<PlatformSettings>;
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    general: sanitiseGeneral(candidate.general, DEFAULT_GENERAL_SETTINGS),
    appearance: sanitiseAppearance(candidate.appearance, DEFAULT_APPEARANCE_SETTINGS),
    workspace: sanitiseWorkspace(candidate.workspace, DEFAULT_WORKSPACE_SETTINGS),
  };
}
