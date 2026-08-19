"use client"

import React from "react"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { getConnector } from "@/lib/connectors/registry"
import { useConnectorReadiness } from "@/hooks/useConnectorReadiness"
import type { ConnectorId } from "@/types/connectors"

/**
 * Gate for any migration screen that needs a configured connector.
 *
 * Wrap a step in this and it renders its children only when the connector is
 * connected *and* has cached metadata. Otherwise it explains what is wrong and
 * offers one button that opens the Administration Center on exactly that
 * connector.
 *
 * The point is that no migration screen should contain connection logic. Before
 * this, each screen that needed Qlik or Tableau grew its own credential form
 * and its own "load spaces" button — which is how the platform ended up asking
 * an administrator to configure the same connector several times over. A
 * migration screen's job is to let someone pick what to migrate; getting
 * connected is the Administration Center's.
 *
 * Usage:
 *
 * ```tsx
 * <ConnectorRequired connectorId="qlik">
 *   <SpacePicker />
 * </ConnectorRequired>
 * ```
 */

export interface ConnectorRequiredProps {
  connectorId: ConnectorId
  children: React.ReactNode
  /** Overrides the default explanation, e.g. to name the step being blocked. */
  description?: string
  /**
   * Renders the children even when the connector is not ready, because the
   * caller knows of another usable configuration.
   *
   * This exists for Tableau, which supports several named connections held in
   * the migration backend. A user with a working saved connection but no
   * Administration Center entry must not be locked out of a migration that
   * works today — the gate is there to stop people re-entering credentials,
   * not to invalidate credentials they already have.
   */
  bypass?: boolean
}

export function ConnectorRequired({
  connectorId,
  children,
  description,
  bypass = false,
}: ConnectorRequiredProps) {
  const { ready, loading, reason, openConfiguration } = useConnectorReadiness(connectorId)

  if (bypass) return <>{children}</>

  // Show a spinner rather than the gate while state is still arriving —
  // flashing "not configured" at someone whose connector is fine is worse than
  // a moment of waiting.
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <Spinner size="medium" label="Checking connector…" />
      </div>
    )
  }

  if (ready) return <>{children}</>

  const connector = getConnector(connectorId)

  return (
    <div className="connector-required-gate">
      <span style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
        {connector?.name ?? "This connector"} needs configuring
      </span>
      <span className="connector-required-reason">{reason}</span>
      <span className="connector-required-reason" style={{ fontSize: "var(--text-sm)" }}>
        {description ??
          "Configure it once in the Administration Center. Credentials are verified and everything available is discovered automatically — every migration after that uses the saved connection."}
      </span>
      <Button onClick={openConfiguration}>
        <Settings size={20} />
        Configure {connector?.name ?? "connector"}
      </Button>
    </div>
  )
}
