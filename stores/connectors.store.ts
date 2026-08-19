"use client"

import { create } from "zustand"

import { getAvailableConnectors } from "@/lib/connectors/registry"
import { isConnectorReady } from "@/lib/connectors/validation"
import { connectorsService } from "@/services/connectors.service"
import type {
  ConnectorActionResponse,
  ConnectorId,
  ConnectorSavePayload,
  ConnectorState,
} from "@/types/connectors"

/**
 * Connector state for the Administration Center and the migration wizard.
 *
 * Held in its own store rather than in `settings.store` because the two have
 * different owners: the settings document is a client patch target, while
 * connector state is written by the server as the result of a test or a sync.
 * Keeping them apart means a settings save can never overwrite a sync result.
 *
 * This store is also what makes "configure once" true in the UI. The migration
 * wizard reads connector readiness and cached metadata from here — it never
 * asks the user to connect or to load anything, and it never re-probes a
 * connector that the Administration Center has already verified this session.
 */

/** Per-connector in-flight flags, so one busy card cannot freeze the grid. */
export type ConnectorBusyKind = "saving" | "testing" | "syncing" | "disconnecting"

interface ConnectorsStore {
  /** Connector state keyed by id. Absent means "never configured". */
  connectors: Partial<Record<ConnectorId, ConnectorState>>

  loaded: boolean
  loading: boolean
  /** Which action, if any, each connector is currently running. */
  busy: Partial<Record<ConnectorId, ConnectorBusyKind>>
  error: string | null
  /** Banner text from the most recent action, keyed by connector. */
  notices: Partial<Record<ConnectorId, { ok: boolean; message: string }>>
  /** Field-level validation errors from the most recent save. */
  fieldErrors: Partial<Record<ConnectorId, Record<string, string>>>

  loadConnectors: (force?: boolean) => Promise<void>
  saveConnector: (id: ConnectorId, payload: ConnectorSavePayload) => Promise<boolean>
  testConnector: (id: ConnectorId) => Promise<boolean>
  syncConnector: (id: ConnectorId) => Promise<boolean>
  disconnectConnector: (id: ConnectorId) => Promise<boolean>

  /**
   * Refreshes stale caches in the background, one request per connected
   * connector. Failures are swallowed — this is opportunistic.
   */
  refreshStale: () => Promise<void>

  dismissNotice: (id: ConnectorId) => void
  clearError: () => void
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export const useConnectorsStore = create<ConnectorsStore>((set, get) => {
  /** Folds an action response back into the store. */
  function applyResponse(
    id: ConnectorId,
    response: ConnectorActionResponse & { fieldErrors?: Record<string, string> },
  ): boolean {
    set((state) => ({
      connectors: {
        ...state.connectors,
        [id]: {
          connectorId: id,
          connection: response.connection,
          metadata: response.metadata,
          logs: response.logs,
        },
      },
      notices: { ...state.notices, [id]: { ok: response.ok, message: response.message } },
      fieldErrors: { ...state.fieldErrors, [id]: response.fieldErrors ?? {} },
    }))
    return response.ok
  }

  function setBusy(id: ConnectorId, kind: ConnectorBusyKind | null): void {
    set((state) => {
      const busy = { ...state.busy }
      if (kind) busy[id] = kind
      else delete busy[id]
      return { busy }
    })
  }

  /** Shared wrapper for the four single-connector actions. */
  async function runAction(
    id: ConnectorId,
    kind: ConnectorBusyKind,
    action: () => Promise<ConnectorActionResponse & { fieldErrors?: Record<string, string> }>,
    failureMessage: string,
  ): Promise<boolean> {
    setBusy(id, kind)
    try {
      return applyResponse(id, await action())
    } catch (error) {
      console.error(`[ConnectorsStore] ${kind} failed for ${id}:`, error)
      const message = toMessage(error, failureMessage)
      set((state) => ({
        notices: { ...state.notices, [id]: { ok: false, message } },
      }))
      return false
    } finally {
      setBusy(id, null)
    }
  }

  return {
    connectors: {},
    loaded: false,
    loading: false,
    busy: {},
    error: null,
    notices: {},
    fieldErrors: {},

    loadConnectors: async (force = false) => {
      if (get().loading) return
      if (get().loaded && !force) return

      set({ loading: true, error: null })
      try {
        const { connectors } = await connectorsService.listConnectors()
        const byId: Partial<Record<ConnectorId, ConnectorState>> = {}
        for (const state of connectors) {
          byId[state.connectorId] = state
        }
        set({ connectors: byId, loaded: true })
      } catch (error) {
        console.error("[ConnectorsStore] Failed to load connectors:", error)
        set({ error: toMessage(error, "Unable to load connector configuration.") })
      } finally {
        set({ loading: false })
      }
    },

    saveConnector: (id, payload) =>
      runAction(id, "saving", () => connectorsService.saveConnector(id, payload), "Unable to save this connector."),

    testConnector: (id) =>
      runAction(id, "testing", () => connectorsService.testConnector(id), "Unable to test this connector."),

    syncConnector: (id) =>
      runAction(id, "syncing", () => connectorsService.syncConnector(id), "Unable to sync metadata."),

    disconnectConnector: (id) =>
      runAction(id, "disconnecting", () => connectorsService.disconnectConnector(id), "Unable to disconnect this connector."),

    refreshStale: async () => {
      const { connectors } = get()

      // Only connectors that are already working are candidates; the server
      // makes the same judgement, but checking here avoids the round trip.
      const candidates = getAvailableConnectors()
        .map((definition) => definition.id)
        .filter((id) => isConnectorReady(connectors[id]?.connection ?? null))

      // Independent requests: one slow tenant must not hold up the others.
      await Promise.allSettled(
        candidates.map(async (id) => {
          try {
            const response = await connectorsService.syncConnector(id, true)
            // Fold in silently. A background refresh should update the cards but
            // must not raise a banner the administrator did not ask for.
            set((state) => ({
              connectors: {
                ...state.connectors,
                [id]: {
                  connectorId: id,
                  connection: response.connection,
                  metadata: response.metadata,
                  logs: response.logs,
                },
              },
            }))
          } catch (error) {
            console.warn(`[ConnectorsStore] Background refresh failed for ${id}:`, error)
          }
        }),
      )
    },

    dismissNotice: (id) =>
      set((state) => {
        const notices = { ...state.notices }
        delete notices[id]
        return { notices }
      }),

    clearError: () => set({ error: null }),
  }
})

// ---------------------------------------------------------------------------
// Selectors for consumers outside the Administration Center
// ---------------------------------------------------------------------------

/**
 * Whether a connector is configured, connected and has cached metadata.
 *
 * This is the check the migration wizard makes before offering a source. A
 * connector that fails it sends the user to Settings rather than into an empty
 * picker.
 */
export function selectConnectorReady(state: ConnectorsStore, id: ConnectorId): boolean {
  return isConnectorReady(state.connectors[id]?.connection ?? null)
}

/** Cached items for one metadata category, or an empty list. */
export function selectMetadataItems(state: ConnectorsStore, id: ConnectorId, kind: string) {
  const collection = state.connectors[id]?.metadata?.collections.find(
    (candidate) => candidate.kind === kind,
  )
  return collection?.supported ? collection.items : []
}
