"use client"

import { create } from "zustand"
import type { TableauConfig } from "./store.types"
import React from "react"
import { isLiteMode } from "@/lib/config"
import { MIGRATION_MODE, MigrationMode } from "@/lib/constants"

interface UIStore {
  workspace: "qlik" | "tableau"
  setWorkspace: (workspace: "qlik" | "tableau") => void
  activeTab: "Migration" | "Monitoring" | "Result" | "History"
  setActiveTab: (tab: "Migration" | "Monitoring" | "Result" | "History") => void
  isSettingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  tableauConfig: TableauConfig
  updateTableauConfig: (config: Partial<TableauConfig>) => void
  migrationMode: MigrationMode
  setMigrationMode: (mode: MigrationMode) => void
// ... (Assessment Continuation Flow remains below)

  // --- Assessment Continuation Flow ---
  mode: 'single' | 'full'
  modeLoaded: boolean
  setMode: (mode: 'single' | 'full') => void
  hasContinued: boolean
  setHasContinued: (continued: boolean) => void
  /** Fetch the interactive status (mode) from the backend (GET). Only calls API if not yet loaded, unless force=true. */
  fetchInteractiveStatus: (force?: boolean) => Promise<'single' | 'full'>

  // --- Data Layer Toggle ---
  dataLayerEnabled: boolean
  dataLayerLoaded: boolean
  setDataLayerEnabled: (enabled: boolean) => void
  /** Fetch the data layer toggle status from the backend (GET). Only calls API if not yet loaded, unless force=true. */
  fetchDataLayerStatus: (force?: boolean) => Promise<boolean>

  // --- Deployment Type ---
  deploymentType: string
  deploymentTypeLoaded: boolean
  setDeploymentType: (type: string) => void
  /** Fetch the Deployment Type from the backend (GET). Only calls API if not yet loaded, unless force=true. */
  fetchDeploymentType: (force?: boolean) => Promise<string>

  // --- Timezone ---
  timezone: string
  timezoneLoaded: boolean
  setTimezone: (tz: string) => void
  /** Fetch the user timezone preference from the backend (GET). Only calls API if not yet loaded, unless force=true. */
  fetchTimezone: (force?: boolean) => Promise<string>

  // --- Active Workbook Selection ---
  selectedWorkbookId: string
  setSelectedWorkbookId: (id: string) => void

  // --- Theme ---
  theme: "light" | "dark"
  setTheme: (theme: "light" | "dark") => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  workspace: "tableau",
  setWorkspace: (workspace) => set({ workspace }),
  activeTab: "Migration",
  setActiveTab: (tab) => set({ activeTab: tab }),
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  isSidebarOpen: true, // Default to true for desktop
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  theme: typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "light" : "light",
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  },
  tableauConfig: {
    serverUrl: "",
    siteId: "",
    authType: "PAT",
    tokenName: "",
    tokenValue: "",
  },
  updateTableauConfig: (config) =>
    set((state) => ({
      tableauConfig: { ...state.tableauConfig, ...config },
    })),
  migrationMode: MIGRATION_MODE.STANDARD,
  setMigrationMode: (migrationMode) => set({ migrationMode }),

  // --- Assessment Continuation Flow ---
  mode: 'full',
  modeLoaded: false,
  setMode: (mode) => set({ mode: isLiteMode() ? 'single' : mode }),
  hasContinued: false,
  setHasContinued: (hasContinued) => set({ hasContinued }),
  fetchInteractiveStatus: async (force = false) => {
    if (isLiteMode()) {
      set({ mode: 'single', modeLoaded: true })
      return 'single'
    }
    if (get().modeLoaded && !force) return get().mode
    try {
      const { recordsService } = await import("@/services/records.service")
      const data = await recordsService.getInteractiveStatus()
      const newMode = data.status === true ? 'single' : 'full'
      set({ mode: newMode, modeLoaded: true })
      console.log("[UIStore] Interactive status fetched from Cosmos:", newMode)
      return newMode
    } catch (err) {
      console.error("[UIStore] Failed to fetch interactive status:", err)
      return get().mode
    }
  },

  // --- Data Layer Toggle ---
  dataLayerEnabled: false,
  dataLayerLoaded: false,
  setDataLayerEnabled: (dataLayerEnabled) => set({ dataLayerEnabled: isLiteMode() ? false : dataLayerEnabled }),
  fetchDataLayerStatus: async (force = false) => {
    if (isLiteMode()) {
      set({ dataLayerEnabled: false, dataLayerLoaded: true })
      return false
    }
    // Skip if already loaded and not a forced refresh
    if (get().dataLayerLoaded && !force) return get().dataLayerEnabled
    try {
      const { recordsService } = await import("@/services/records.service")
      const data = await recordsService.getDataLayerStatus()
      const enabled = data.status === true
      set({ dataLayerEnabled: enabled, dataLayerLoaded: true })
      console.log("[UIStore] Data layer status fetched from Cosmos:", enabled)
      return enabled
    } catch (err) {
      console.error("[UIStore] Failed to fetch data layer status:", err)
      return get().dataLayerEnabled
    }
  },

  // --- Deployment Type ---
  deploymentType: "GIT",
  deploymentTypeLoaded: false,
  setDeploymentType: (deploymentType) => set({ deploymentType }),
  fetchDeploymentType: async (force = false) => {
    if (get().deploymentTypeLoaded && !force) return get().deploymentType
    try {
      const { recordsService } = await import("@/services/records.service")
      const data = await recordsService.getDeploymentType()
      const type = data.deployment_type || ""
      set({ deploymentType: type, deploymentTypeLoaded: true })
      console.log("[UIStore] Deployment Type fetched from Cosmos:", type)
      return type
    } catch (err) {
      console.error("[UIStore] Failed to fetch Deployment Type:", err)
      return get().deploymentType
    }
  },

  // --- Timezone ---
  timezone: "UTC",
  timezoneLoaded: false,
  setTimezone: (timezone) => set({ timezone }),
  fetchTimezone: async (force = false) => {
    if (get().timezoneLoaded && !force) return get().timezone
    try {
      const { recordsService } = await import("@/services/records.service")
      // We still fetch settings in case we need other properties, but for timezone we prioritize browser.
      const data = await recordsService.getSettings()
      
      let detectedTz = "UTC"
      try {
        detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        console.log("[Timezone Debug] Intl.DateTimeFormat().resolvedOptions().timeZone returned:", detectedTz)
      } catch (e) {
        console.warn("[UIStore] Could not detect browser timezone, falling back to UTC")
      }

      // Always use the browser detected timezone upon load/refresh as the source of truth for the user's current physical location.
      const activeTz = detectedTz;
      
      set({ timezone: activeTz, timezoneLoaded: true })
      console.log("[UIStore] Timezone initialized to detected region:", activeTz)

      // Silently sync the detected timezone back to the backend if it differs from what was stored
      let backendTz = data?.settings?.timezone || data?.timezone
      if (backendTz !== activeTz) {
        try {
          await recordsService.updateTimezone(activeTz)
          console.log("[UIStore] Synced detected timezone to backend:", activeTz)
        } catch (e) {
          console.warn("[UIStore] Failed to sync detected timezone to backend", e)
        }
      }

      return activeTz
    } catch (err) {
      console.error("[UIStore] Failed to fetch timezone:", err)
      return get().timezone
    }
  },

  // --- Active Workbook Selection ---
  selectedWorkbookId: "",
  setSelectedWorkbookId: (selectedWorkbookId) => set({ selectedWorkbookId }),
}))
