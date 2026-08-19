"use client"

import React from "react"
import { Spinner } from "@/components/ui/spinner"

/** A centered spinner with a label, for the loading branch of an API-backed view. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "32px", minHeight: "120px" }}>
      <Spinner size="medium" label={label} />
    </div>
  )
}
