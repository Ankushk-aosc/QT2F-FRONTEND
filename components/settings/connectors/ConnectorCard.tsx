"use client"

import React from "react"
import { RefreshCw, Plug, Settings } from "lucide-react"

import type { ConnectorDefinition } from "@/lib/connectors/registry"
import type { ConnectorBusyKind } from "@/stores/connectors.store"
import type { ConnectorState } from "@/types/connectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { ConnectorLogo } from "./ConnectorLogo"
import { LastSyncLabel, StatusRow } from "./StatusBadges"

/**
 * A connector's card in the Integrations grid.
 *
 * Presentational: every action is a callback, and the card holds no state of
 * its own. That is what lets the same component render Qlik, Tableau, Fabric
 * and every future connector — it reads the definition and the connection, and
 * knows nothing about either platform.
 *
 * The facts shown are the ones an administrator needs to answer "can I run a
 * migration with this right now" without opening anything: what it is, whether
 * it is connected, whether it is healthy, who it authenticated as, which
 * workspace it landed in, and how stale the metadata is.
 */

/** Human label for the authentication method actually in use. */
const AUTH_LABELS: Record<string, string> = {
  "api-key": "API key",
  basic: "Username and password",
  certificate: "Certificate",
  pat: "Personal access token",
  oauth: "OAuth",
  "entra-id": "Microsoft Entra ID",
  "service-principal": "Service principal",
}

export interface ConnectorCardProps {
  connector: ConnectorDefinition
  state: ConnectorState | undefined
  busy: ConnectorBusyKind | undefined
  onConfigure: () => void
  onTest: () => void
  onSync: () => void
}

/** One row of the facts grid, omitted entirely when there is nothing to show. */
function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null

  return (
    <>
      <span className="connector-fact-label">{label}</span>
      <span className="connector-fact-value" title={value}>
        {value}
      </span>
    </>
  )
}

export function ConnectorCard({
  connector,
  state,
  busy,
  onConfigure,
  onTest,
  onSync,
}: ConnectorCardProps) {
  const planned = connector.availability !== "available"
  const connection = state?.connection ?? null
  const isConfigured = connection !== null && connection.status !== "not-configured"

  // The method actually stored, falling back to the connector's only option.
  // Qlik offers three, so reading it from the saved values is the only way to
  // show what is really in use.
  const authValue =
    (connection?.values.authMethod as string | undefined) ?? connector.authMethods[0] ?? ""

  if (planned) {
    return (
      <div className="connector-card connector-card-planned">
        <div className="connector-card-header">
          <ConnectorLogo connector={connector} muted />
          <div className="connector-card-heading">
            <span className="connector-card-name">{connector.name}</span>
            <span className="connector-card-vendor">{connector.vendor}</span>
          </div>
          <Badge variant="outline">Coming soon</Badge>
        </div>

        <p className="connector-card-description">{connector.description}</p>

        {/* Says plainly that there is nothing to configure, rather than
            offering a disabled form that would discard whatever was typed. */}
        <p className="connector-card-vendor">{connector.plannedNote}</p>
      </div>
    )
  }

  return (
    <div className="connector-card">
      <div className="connector-card-header">
        <ConnectorLogo connector={connector} />
        <div className="connector-card-heading">
          <span className="connector-card-name">{connector.name}</span>
          <span className="connector-card-vendor">{connector.vendor}</span>
        </div>
      </div>

      <p className="connector-card-description">{connector.description}</p>

      <StatusRow connection={connection} />

      <div className="connector-facts">
        <Fact label="Version" value={connection?.version ?? ""} />
        <Fact label="Authentication" value={AUTH_LABELS[authValue] ?? ""} />
        <Fact label="User" value={connection?.connectedUser ?? ""} />
        <Fact label="Workspace" value={connection?.connectedWorkspace ?? ""} />
      </div>

      <LastSyncLabel connection={connection} />

      <div className="connector-card-footer">
        <div className="connector-card-actions">
          <Button
            variant={isConfigured ? "secondary" : "default"}
            onClick={onConfigure}
            disabled={busy !== undefined}
          >
            {isConfigured ? <Settings size={16} /> : <Plug size={16} />}
            {isConfigured ? "Edit" : "Connect"}
          </Button>

          {/* Test and Sync are meaningless before there are credentials to
              test, so they appear only once the connector is configured. */}
          {isConfigured ? (
            <>
              <Button variant="ghost" onClick={onTest} disabled={busy !== undefined}>
                {busy === "testing" ? <Spinner size="tiny" /> : null}
                Test
              </Button>
              <Button variant="ghost" onClick={onSync} disabled={busy !== undefined}>
                {busy === "syncing" ? <Spinner size="tiny" /> : <RefreshCw size={16} />}
                Sync
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
