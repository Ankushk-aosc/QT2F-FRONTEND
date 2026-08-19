"use client"

import React, { useEffect, useRef, useState } from "react"
import { Check, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/settings/defaults"
import { useSettingsStore } from "@/stores/settings.store"

/**
 * The settings action bar.
 *
 * This platform saves each control as it changes, so there is no pending edit
 * for a "Save"/"Cancel" pair to act on — offering them would imply changes are
 * being held back when they are already persisted. Instead the bar reports the
 * save state honestly and offers the one action that genuinely has something to
 * do: restoring defaults.
 */
export function SettingsFooter() {
  const saving = useSettingsStore((s) => s.saving)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [justSaved, setJustSaved] = useState(false)
  const wasSaving = useRef(false)

  // Show "Saved" briefly on the falling edge of `saving`.
  useEffect(() => {
    if (wasSaving.current && !saving) {
      setJustSaved(true)
      const id = setTimeout(() => setJustSaved(false), 2500)
      return () => clearTimeout(id)
    }
    wasSaving.current = saving
  }, [saving])

  const handleReset = () => {
    void updateSettings({
      general: { ...DEFAULT_PLATFORM_SETTINGS.general },
      appearance: { ...DEFAULT_PLATFORM_SETTINGS.appearance },
      workspace: { ...DEFAULT_PLATFORM_SETTINGS.workspace },
    })
  }

  return (
    <div className="settings-footer">
      <Button variant="outline" onClick={handleReset} disabled={saving}>
        <RotateCcw size={16} />
        Reset to Defaults
      </Button>

      <span className="settings-footer-status" aria-live="polite">
        {saving ? (
          <>
            <Spinner size="tiny" />
            Saving…
          </>
        ) : justSaved ? (
          <>
            <Check size={16} />
            Saved
          </>
        ) : (
          "Changes save automatically"
        )}
      </span>
    </div>
  )
}
