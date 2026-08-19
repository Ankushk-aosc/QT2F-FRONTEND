"use client"

import React from "react"

import type { ConnectorDefinition } from "@/lib/connectors/registry"

/**
 * The logo tile on a connector card.
 *
 * Renders the definition's monogram over its accent colour rather than a vendor
 * logo. Two reasons, both deliberate: bundling third-party marks raises
 * trademark questions that a migration tool does not need to answer, and a
 * remote logo that fails to load leaves a broken card. A monogram is always
 * available and always legible.
 *
 * The accent is used at low opacity behind foreground text taken from the same
 * hue, so contrast holds in both themes without a per-connector palette.
 */

export interface ConnectorLogoProps {
  connector: ConnectorDefinition
  size?: "medium" | "large"
  /** Dims the tile, used for connectors that are not available yet. */
  muted?: boolean
}

export function ConnectorLogo({ connector, size = "medium", muted = false }: ConnectorLogoProps) {
  const classes = [
    "connector-logo",
    size === "large" ? "connector-logo-large" : "connector-logo-medium",
    muted ? "connector-logo-muted" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      aria-hidden="true"
      className={classes}
      style={{
        // Inline rather than tokenised: the accent is per-connector data from
        // the registry, so it cannot be a static class.
        backgroundColor: `${connector.accent}1f`,
        color: connector.accent,
        border: `1px solid ${connector.accent}3d`,
      }}
    >
      {connector.monogram}
    </div>
  )
}
