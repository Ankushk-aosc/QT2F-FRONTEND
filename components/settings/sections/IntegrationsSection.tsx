"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"

import {
  CONNECTORS,
  getConnector,
  type ConnectorDefinition,
} from "@/lib/connectors/registry"
import { useConnectorsStore } from "@/stores/connectors.store"
import { useSettingsStore } from "@/stores/settings.store"
import type { ConnectorId } from "@/types/connectors"
import { Input } from "@/components/ui/input"

import { ConnectorCard } from "../connectors/ConnectorCard"
import { ConnectorDetail } from "../connectors/ConnectorDetail"
import { ConnectorGridSkeleton, EmptyState, ResultBanner } from "../connectors/ConnectorFeedback"

/**
 * Integrations — the single place every external platform is configured.
 *
 * The page has two modes rather than two routes: a grid of connector cards, and
 * one connector's detail. Keeping it inside the settings drawer means the
 * migration wizard can deep-link an administrator straight to the connector
 * they need and land them back where they were.
 *
 * The grid is built from the registry, not from what happens to be configured,
 * so a connector the platform supports is always visible even before anyone has
 * touched it — an administrator should be able to see what is possible without
 * first knowing it exists.
 */

export function IntegrationsSection() {
  const connectors = useConnectorsStore((store) => store.connectors)
  const busy = useConnectorsStore((store) => store.busy)
  const loading = useConnectorsStore((store) => store.loading)
  const loaded = useConnectorsStore((store) => store.loaded)
  const error = useConnectorsStore((store) => store.error)
  const loadConnectors = useConnectorsStore((store) => store.loadConnectors)
  const refreshStale = useConnectorsStore((store) => store.refreshStale)
  const testConnector = useConnectorsStore((store) => store.testConnector)
  const syncConnector = useConnectorsStore((store) => store.syncConnector)
  const clearError = useConnectorsStore((store) => store.clearError)

  // Lets the migration wizard open this section with a connector preselected.
  const requestedConnector = useSettingsStore((store) => store.requestedConnectorId)
  const clearRequestedConnector = useSettingsStore((store) => store.setRequestedConnector)

  const [selected, setSelected] = useState<ConnectorId | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    void loadConnectors()
  }, [loadConnectors])

  // Refresh stale caches once the initial load has settled. Deliberately after
  // `loaded` rather than alongside it: the grid should paint from cache
  // immediately, and refreshing is a background concern.
  useEffect(() => {
    if (loaded) void refreshStale()
  }, [loaded, refreshStale])

  // Honour a deep link from the migration wizard, then clear it so returning to
  // Integrations later does not jump into a connector unexpectedly.
  useEffect(() => {
    if (requestedConnector) {
      setSelected(requestedConnector)
      clearRequestedConnector(null)
    }
  }, [requestedConnector, clearRequestedConnector])

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return [...CONNECTORS]

    return CONNECTORS.filter((connector) =>
      [connector.name, connector.vendor, connector.description]
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    )
  }, [query])

  const available = matches.filter((connector) => connector.availability === "available")
  const planned = matches.filter((connector) => connector.availability !== "available")

  if (selected) {
    const definition = getConnector(selected)
    if (definition) {
      return <ConnectorDetail connector={definition} onBack={() => setSelected(null)} />
    }
  }

  const renderCard = (connector: ConnectorDefinition) => (
    <ConnectorCard
      key={connector.id}
      connector={connector}
      state={connectors[connector.id]}
      busy={busy[connector.id]}
      onConfigure={() => setSelected(connector.id)}
      onTest={() => void testConnector(connector.id)}
      onSync={() => void syncConnector(connector.id)}
    />
  )

  return (
    <div className="integrations-panel">
      <header className="settings-panel-header">
        <h2 className="settings-panel-title">Integrations</h2>
        <p className="settings-panel-description">
          Configure each platform once. Credentials are verified and metadata is discovered
          automatically on save, then reused by every migration.
        </p>
      </header>

      {error ? (
        <ResultBanner
          ok={false}
          message={error}
          onDismiss={clearError}
          onRetry={() => void loadConnectors(true)}
        />
      ) : null}

      <div className="integrations-search">
        <Search size={16} className="integrations-search-icon" />
        <Input
          placeholder="Search connectors"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search connectors"
          style={{ paddingLeft: "32px" }}
        />
      </div>

      {loading && !loaded ? (
        <ConnectorGridSkeleton />
      ) : matches.length === 0 ? (
        <EmptyState
          title="No connectors match"
          description={`Nothing in the catalogue matches "${query}". Clear the search to see all supported platforms.`}
        />
      ) : (
        <>
          {available.length > 0 ? (
            <section>
              <div className="integrations-group-label">
                <span className="settings-group-header" style={{ marginBottom: 0 }}>
                  Supported
                </span>
                <span className="settings-row-hint">Ready to configure</span>
              </div>
              <div className="integrations-grid">{available.map(renderCard)}</div>
            </section>
          ) : null}

          {planned.length > 0 ? (
            <section>
              <div className="integrations-group-label">
                <span className="settings-group-header" style={{ marginBottom: 0 }}>
                  Coming soon
                </span>
                <span className="settings-row-hint">Listed so the roadmap is visible — not configurable yet</span>
              </div>
              <div className="integrations-grid">{planned.map(renderCard)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
