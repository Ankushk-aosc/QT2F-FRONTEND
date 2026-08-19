"use client"

import { create } from "zustand"

import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/settings/defaults"
import { DEFAULT_SECTION_ID, type SettingsSectionId } from "@/lib/settings/navigation"
import { settingsService } from "@/services/settings.service"
import { useUIStore } from "@/stores/ui.store"
import type { ConnectorId } from "@/types/connectors"
import type {
  PlatformSettings,
  PlatformSettingsPatch,
  ResolvedTheme,
  ThemeMode,
} from "@/types/settings"

/**
 * State for the Enterprise Administration Center.
 *
 * Ownership rule, to keep a single source of truth:
 *
 *  - This store owns the persisted settings document (`PlatformSettings`).
 *  - `ui.store` continues to own the *live* UI state that the rest of the app
 *    already reads — notably `theme`, which `ClientProviders` hands to the
 *    Fluent provider, and `timezone`, used across run history and logs.
 *
 * Rather than duplicating those values, this store projects the relevant parts
 * of the settings document into `ui.store` whenever they change. Existing
 * components keep working untouched and there is still exactly one writer.
 */

/** Resolves "system" against the OS preference. Safe to call during SSR. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== "system") return mode
  if (typeof window === "undefined" || !window.matchMedia) return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

interface SettingsStore {
  settings: PlatformSettings
  applicationVersion: string
  updatedAt: string | null

  /** True once the settings document has been fetched at least once. */
  loaded: boolean
  loading: boolean
  saving: boolean
  /** Human-readable message for the most recent failure, or null. */
  error: string | null

  /** Currently selected section in the admin navigation. */
  activeSection: SettingsSectionId
  setActiveSection: (section: SettingsSectionId) => void

  /**
   * A connector the Integrations section should open directly, set by callers
   * outside the Administration Center.
   *
   * This is how the migration wizard sends an administrator to configure the
   * exact connector that is blocking them, rather than to the Integrations grid
   * to find it themselves. The section consumes it and clears it, so it is a
   * one-shot instruction rather than persistent selection.
   */
  requestedConnectorId: ConnectorId | null
  setRequestedConnector: (connectorId: ConnectorId | null) => void

  /** Fetches settings. Skips the request if already loaded unless `force`. */
  loadSettings: (force?: boolean) => Promise<void>

  /**
   * Applies a patch optimistically, persists it, and rolls back if the server
   * rejects the change. Returns true when the save succeeded.
   */
  updateSettings: (patch: PlatformSettingsPatch) => Promise<boolean>

  clearError: () => void
}

/**
 * Pushes settings values into `ui.store` so existing consumers stay in sync
 * without holding their own copy of the setting.
 */
function projectToUIStore(settings: PlatformSettings): void {
  const ui = useUIStore.getState()

  const resolved = resolveTheme(settings.appearance.themeMode)
  if (ui.theme !== resolved) {
    ui.setTheme(resolved)
  }

  if (settings.general.timezone && ui.timezone !== settings.general.timezone) {
    ui.setTimezone(settings.general.timezone)
  }
}

/** Deep-merges a patch into the current document for optimistic rendering. */
function mergePatch(current: PlatformSettings, patch: PlatformSettingsPatch): PlatformSettings {
  return {
    ...current,
    general: { ...current.general, ...patch.general },
    appearance: { ...current.appearance, ...patch.appearance },
    workspace: { ...current.workspace, ...patch.workspace },
  }
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_PLATFORM_SETTINGS,
  applicationVersion: "",
  updatedAt: null,

  loaded: false,
  loading: false,
  saving: false,
  error: null,

  activeSection: DEFAULT_SECTION_ID,
  setActiveSection: (activeSection) => set({ activeSection }),

  requestedConnectorId: null,
  setRequestedConnector: (requestedConnectorId) => set({ requestedConnectorId }),

  loadSettings: async (force = false) => {
    if (get().loading) return
    if (get().loaded && !force) return

    set({ loading: true, error: null })
    try {
      const response = await settingsService.getSettings()
      set({
        settings: response.settings,
        applicationVersion: response.applicationVersion,
        updatedAt: response.updatedAt,
        loaded: true,
      })
      projectToUIStore(response.settings)
    } catch (error) {
      console.error("[SettingsStore] Failed to load settings:", error)
      set({ error: toMessage(error, "Unable to load platform settings.") })
    } finally {
      set({ loading: false })
    }
  },

  updateSettings: async (patch) => {
    const previous = get().settings

    // Optimistic update so the control reflects the change immediately.
    const optimistic = mergePatch(previous, patch)
    set({ settings: optimistic, saving: true, error: null })
    projectToUIStore(optimistic)

    try {
      const response = await settingsService.updateSettings(patch)
      // Trust the server's response over the optimistic value: the repository
      // validates and may normalise what it stored.
      set({
        settings: response.settings,
        applicationVersion: response.applicationVersion,
        updatedAt: response.updatedAt,
        loaded: true,
      })
      projectToUIStore(response.settings)
      return true
    } catch (error) {
      console.error("[SettingsStore] Failed to save settings:", error)
      set({ settings: previous, error: toMessage(error, "Unable to save settings.") })
      projectToUIStore(previous)
      return false
    } finally {
      set({ saving: false })
    }
  },

  clearError: () => set({ error: null }),
}))
