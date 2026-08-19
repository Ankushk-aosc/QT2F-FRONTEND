"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"

import { getConnector } from "@/lib/connectors/registry"
import { isConnectorReady } from "@/lib/connectors/validation"
import { useConnectorsStore } from "@/stores/connectors.store"
import type { ConnectorConnection, ConnectorId, MetadataItem } from "@/types/connectors"

/**
 * The migration wizard's view of a connector.
 *
 * This hook is what turns "configure once" from an intention into behaviour. A
 * migration screen asks whether its source is ready and, if so, reads the
 * cached spaces, projects, applications or workbooks straight out of the store.
 * It never asks the user to connect, never presents a credential form and never
 * triggers a load — the Administration Center did all of that at save time.
 *
 * When a connector is *not* ready the hook does not improvise. It offers
 * `openConfiguration`, which navigates to that exact connector in Settings.
 * Once configured, the back button returns them to where they were with the
 * pickers populated — the "redirect, configure, return" path, without the
 * wizard ever holding connection logic of its own.
 */

export interface ConnectorReadiness {
  /** True when the connector is connected and has cached metadata. */
  ready: boolean
  /**
   * The saved connection, or null when never configured.
   *
   * Exposed so a dashboard card can show *which* tenant is connected without
   * reaching into the store itself. Holds no secret — `ConnectorConnection`
   * records only that a secret exists, never its value.
   */
  connection: ConnectorConnection | null
  /** True while connector state is still being fetched — not the same as unready. */
  loading: boolean
  /** Why the connector is unusable, phrased for the wizard. Empty when ready. */
  reason: string
  /** Opens the Administration Center on this connector. */
  openConfiguration: () => void
  /** Cached items for a metadata category, e.g. "spaces" or "workbooks". */
  items: (kind: string) => MetadataItem[]
  /** Items whose `parentId` matches, e.g. workbooks within a project. */
  childrenOf: (kind: string, parentId: string) => MetadataItem[]
  /** ISO timestamp of the cached snapshot, or null. */
  syncedAt: string | null
}

export function useConnectorReadiness(connectorId: ConnectorId): ConnectorReadiness {
  const state = useConnectorsStore((store) => store.connectors[connectorId])
  const loading = useConnectorsStore((store) => store.loading)
  const loaded = useConnectorsStore((store) => store.loaded)
  const loadConnectors = useConnectorsStore((store) => store.loadConnectors)

  const router = useRouter()

  // Connector state is shared across the app, and `loadConnectors` is a no-op
  // once loaded — so several wizard steps mounting at once cost one request.
  useEffect(() => {
    void loadConnectors()
  }, [loadConnectors])

  const connection = state?.connection ?? null
  const metadata = state?.metadata ?? null
  const ready = isConnectorReady(connection)

  const reason = useMemo(() => {
    if (ready) return ""

    const name = getConnector(connectorId)?.name ?? connectorId

    // Distinguish the three unready cases: they need different actions from the
    // administrator, and a single "not configured" message would send someone
    // to re-enter credentials that are already correct.
    if (!connection || connection.status === "not-configured") {
      return `${name} has not been configured yet.`
    }
    if (connection.status === "error") {
      return connection.healthMessage || `The connection to ${name} is failing.`
    }
    if (connection.status === "disconnected") {
      return `${name} is disconnected.`
    }
    return `${name} is connected but its metadata has not been discovered yet.`
  }, [ready, connection, connectorId])

  // Deep-links to the exact connector rather than opening settings generally,
  // so the administrator lands on the form that unblocks them. It is a URL, so
  // the back button returns them to the migration screen they came from.
  const openConfiguration = useCallback(() => {
    router.push(`/settings?section=integrations&connector=${encodeURIComponent(connectorId)}`)
  }, [connectorId, router])

  const items = useCallback(
    (kind: string): MetadataItem[] => {
      const collection = metadata?.collections.find((candidate) => candidate.kind === kind)
      // An unsupported category is not an empty one; returning [] for both is
      // fine here because the wizard has nothing to offer either way.
      return collection?.supported ? collection.items : []
    },
    [metadata],
  )

  const childrenOf = useCallback(
    (kind: string, parentId: string): MetadataItem[] =>
      items(kind).filter((item) => item.parentId === parentId),
    [items],
  )

  return {
    ready,
    connection,
    loading: loading && !loaded,
    reason,
    openConfiguration,
    items,
    childrenOf,
    syncedAt: metadata?.syncedAt ?? null,
  }
}
