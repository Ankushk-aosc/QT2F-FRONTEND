"use client"

import { create } from "zustand"
import React from "react"
import { isLiteMode } from "@/lib/config"
import { MIGRATION_MODE, MigrationMode } from "@/lib/constants"

interface UIStore {
  workspace: "qlik" | "tableau"
  setWorkspace: (workspace: "qlik" | "tableau") => void
  activeTab: "Migration" | "Monitoring" | "Result" | "History"
  setActiveTab: (tab: "Migration" | "Monitoring" | "Result" | "History") => void
  /** The contextual agent/run panel shown beside migration screens. */
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  /** The primary navigation rail. Collapsed to icons when false. */
  isNavOpen: boolean
  setNavOpen: (open: boolean) => void
  toggleNav: () => void
  migrationMode: MigrationMode
  setMigrationMode: (mode: MigrationMode) => void
  /** Feature toggle for stages beyond Parsing (Mapping onward). */
  fullProcessingEnabled: boolean
  setFullProcessingEnabled: (enabled: boolean) => void
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
  isSidebarOpen: false,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  isNavOpen: true,
  setNavOpen: (open) => set({ isNavOpen: open }),
  toggleNav: () => set((state) => ({ isNavOpen: !state.isNavOpen })),
  theme: typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark") || "light" : "light",
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  },
  migrationMode: MIGRATION_MODE.STANDARD,
  setMigrationMode: (migrationMode) => set({ migrationMode }),
  fullProcessingEnabled: typeof window !== "undefined" && process.env.NEXT_PUBLIC_ENABLE_FULL_PROCESSING === "1",
  setFullProcessingEnabled: (fullProcessingEnabled) => set({ fullProcessingEnabled }),

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
      // Detect the browser timezone first — this is the primary source of truth
      // and does not depend on any backend service.
      let detectedTz = "UTC"
      try {
        detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        console.log("[Timezone Debug] Intl.DateTimeFormat().resolvedOptions().timeZone returned:", detectedTz)
      } catch (e) {
        console.warn("[UIStore] Could not detect browser timezone, falling back to UTC")
      }

      const activeTz = detectedTz;
      set({ timezone: activeTz, timezoneLoaded: true })
      console.log("[UIStore] Timezone initialized to detected region:", activeTz)

      // Best-effort: fetch backend settings and sync timezone if it differs.
      // A backend outage should never block the UI from loading.
      try {
        const { recordsService } = await import("@/services/records.service")
        const data = await recordsService.getSettings()

        let backendTz = data?.settings?.timezone || data?.timezone
        if (backendTz !== activeTz) {
          try {
            await recordsService.updateTimezone(activeTz)
            console.log("[UIStore] Synced detected timezone to backend:", activeTz)
          } catch (e) {
            console.warn("[UIStore] Failed to sync detected timezone to backend", e)
          }
        }
      } catch (backendErr) {
        console.warn("[UIStore] Backend unavailable for timezone sync, using browser timezone:", activeTz)
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
