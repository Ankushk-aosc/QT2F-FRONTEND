"use client"

import React, { useState } from "react"
import { ArrowLeft, RefreshCw, Unplug } from "lucide-react"

import type { ConnectorDefinition } from "@/lib/connectors/registry"
import { useConnectorsStore } from "@/stores/connectors.store"
import type { ConnectorSavePayload } from "@/types/connectors"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

import { ConnectionLogs } from "./ConnectionLogs"
import { ConnectorLogo } from "./ConnectorLogo"
import { ResultBanner } from "./ConnectorFeedback"
import { ConnectorForm } from "./ConnectorForm"
import { MetadataViewer } from "./MetadataViewer"
import { LastSyncLabel, StatusRow } from "./StatusBadges"

/**
 * Everything about one connector: configuration, discovered metadata and
 * activity, behind three tabs.
 *
 * Split into tabs rather than one long scroll because the three answer
 * different questions and are consulted at different times — you configure
 * once, then return to check what was discovered or why something failed.
 *
 * Every action routes through the connectors store, so the card in the grid
 * behind this panel stays in step without any prop threading.
 */

type DetailTab = "configuration" | "metadata" | "logs"

export interface ConnectorDetailProps {
  connector: ConnectorDefinition
  onBack: () => void
}

export function ConnectorDetail({ connector, onBack }: ConnectorDetailProps) {
  const state = useConnectorsStore((store) => store.connectors[connector.id])
  const busy = useConnectorsStore((store) => store.busy[connector.id])
  const notice = useConnectorsStore((store) => store.notices[connector.id])
  const fieldErrors = useConnectorsStore((store) => store.fieldErrors[connector.id]) ?? {}

  const saveConnector = useConnectorsStore((store) => store.saveConnector)
  const testConnector = useConnectorsStore((store) => store.testConnector)
  const syncConnector = useConnectorsStore((store) => store.syncConnector)
  const disconnectConnector = useConnectorsStore((store) => store.disconnectConnector)
  const dismissNotice = useConnectorsStore((store) => store.dismissNotice)

  const [tab, setTab] = useState<DetailTab>("configuration")
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  const connection = state?.connection ?? null
  const isConfigured = connection !== null && connection.status !== "not-configured"

  const handleSave = async (payload: ConnectorSavePayload) => {
    const ok = await saveConnector(connector.id, payload)
    // On success the interesting content is what was discovered, so move the
    // administrator there rather than leaving them on a form they just finished.
    if (ok) setTab("metadata")
  }

  const handleDisconnect = async () => {
    setConfirmingDisconnect(false)
    await disconnectConnector(connector.id)
  }

  return (
    <div className="connector-detail">
      <div className="connector-detail-header">
        <ConnectorLogo connector={connector} size="large" />
        <div className="connector-detail-heading">
          <div className="connector-detail-title-row">
            <h2 className="connector-detail-title">{connector.name}</h2>
            <StatusRow connection={connection} />
          </div>
          <p className="connector-card-description">{connector.description}</p>
          <LastSyncLabel connection={connection} />
        </div>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          All connectors
        </Button>
      </div>

      {notice ? (
        <ResultBanner
          ok={notice.ok}
          message={notice.message}
          onDismiss={() => dismissNotice(connector.id)}
          onRetry={!notice.ok && isConfigured ? () => void testConnector(connector.id) : undefined}
        />
      ) : null}

      {/* Test, sync and disconnect only make sense once there are credentials.
          Before that the form below is the only meaningful action. */}
      {isConfigured ? (
        <div className="connector-detail-toolbar">
          <Button
            variant="secondary"
            onClick={() => void testConnector(connector.id)}
            disabled={busy !== undefined}
          >
            {busy === "testing" ? <Spinner size="tiny" /> : null}
            Test connection
          </Button>
          <Button
            variant="secondary"
            onClick={() => void syncConnector(connector.id)}
            disabled={busy !== undefined}
          >
            {busy === "syncing" ? <Spinner size="tiny" /> : <RefreshCw size={16} />}
            Sync metadata
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmingDisconnect(true)}
            disabled={busy !== undefined}
            style={{ color: "var(--danger)" }}
          >
            <Unplug size={16} />
            Disconnect
          </Button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(value: string) => setTab(value as DetailTab)}>
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="metadata">Discovered metadata</TabsTrigger>
          <TabsTrigger value="logs">Activity</TabsTrigger>
        </TabsList>

        <div style={{ paddingTop: "8px" }}>
          <TabsContent value="configuration">
            <ConnectorForm
              connector={connector}
              connection={connection}
              fieldErrors={fieldErrors}
              saving={busy === "saving"}
              onSave={(payload) => void handleSave(payload)}
            />
          </TabsContent>

          <TabsContent value="metadata">
            <MetadataViewer connector={connector} metadata={state?.metadata ?? null} />
          </TabsContent>

          <TabsContent value="logs">
            <ConnectionLogs logs={state?.logs ?? []} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Disconnect destroys the stored credential, which cannot be undone from
          here — worth a confirmation, unlike the other two actions. */}
      <Dialog open={confirmingDisconnect} onOpenChange={setConfirmingDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {connector.name}?</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            The stored credentials are destroyed and the cached metadata is cleared. Migrations
            that rely on this connector will send you back here to reconnect.
            <br />
            <br />
            The rest of the configuration is kept, so reconnecting means re-entering only the
            credential.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmingDisconnect(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => void handleDisconnect()}>
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
