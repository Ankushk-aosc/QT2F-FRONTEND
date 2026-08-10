"use client"

import { useEffect } from "react"

import { FONT_SIZE_SCALE } from "@/lib/settings/defaults"
import { resolveTheme, useSettingsStore } from "@/stores/settings.store"
import { useUIStore } from "@/stores/ui.store"

/**
 * Applies appearance settings to the document.
 *
 * Fluent UI handles the light/dark palette through its provider, but font
 * scaling, motion and density are document-level concerns. Those are exposed as
 * attributes and a root font size so `globals.css` can react to them, which
 * keeps the styling in CSS rather than scattered through components.
 *
 * Mount this once, near the root of the client tree.
 */
export function useAppearanceSettings(): void {
  const appearance = useSettingsStore((state) => state.settings.appearance)
  const setTheme = useUIStore((state) => state.setTheme)

  const { themeMode, fontSize, compactMode, animationsEnabled, dashboardDensity, cardStyle, sidebarStyle } =
    appearance

  // Root font size drives every rem-based measurement in the app.
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_SCALE[fontSize]
  }, [fontSize])

  // Expose the remaining preferences as data attributes for CSS to consume.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.animations = animationsEnabled ? "on" : "off"
    root.dataset.compact = compactMode ? "on" : "off"
    root.dataset.density = dashboardDensity
    root.dataset.cardStyle = cardStyle
    root.dataset.sidebarStyle = sidebarStyle
  }, [animationsEnabled, compactMode, dashboardDensity, cardStyle, sidebarStyle])

  // When following the OS, react to the user changing it while the app is open.
  useEffect(() => {
    if (themeMode !== "system") {
      setTheme(resolveTheme(themeMode))
      return
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const sync = () => setTheme(media.matches ? "dark" : "light")

    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [themeMode, setTheme])
}
