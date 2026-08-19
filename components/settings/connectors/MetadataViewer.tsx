"use client"

import React from "react"

import type { ConnectorDefinition } from "@/lib/connectors/registry"
import type { ConnectorMetadata, MetadataCollection } from "@/types/connectors"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

import { EmptyState } from "./ConnectorFeedback"
import { formatRelativeTime } from "./StatusBadges"

/**
 * Shows what auto-discovery found for a connector.
 *
 * The design rule here is that **an unsupported category and an empty category
 * must not look the same**. "0 spaces" and "this adapter cannot read spaces"
 * lead an administrator to completely different actions — one is a tenant with
 * nothing in it, the other is a gap in the wiring. So unsupported collections
 * render with their reason attached rather than as an empty list, and they are
 * ordered after the ones that carry data.
 *
 * Like every other component here, it is driven by the connector definition and
 * the cached snapshot. It has no per-platform knowledge.
 */

/** Items rendered before the list is truncated with a count. */
const VISIBLE_ITEM_LIMIT = 100

function CollectionPanel({ collection }: { collection: MetadataCollection }) {
  if (!collection.supported) {
    return (
      <div className="metadata-unsupported">
        <span>{collection.note ?? "Not available from the wired adapter."}</span>
      </div>
    )
  }

  if (collection.items.length === 0) {
    return (
      <div className="metadata-unsupported">
        <span>
          Discovery succeeded and found nothing in this category.
          {collection.note ? ` ${collection.note}` : ""}
        </span>
      </div>
    )
  }

  const visible = collection.items.slice(0, VISIBLE_ITEM_LIMIT)
  const hidden = collection.items.length - visible.length

  return (
    <div>
      {collection.note ? <p className="metadata-note">{collection.note}</p> : null}

      <div className="metadata-items">
        {visible.map((item) => (
          <div key={`${collection.kind}-${item.id}`} className="metadata-item">
            <span className="metadata-item-name">{item.name}</span>
            {item.detail ? <span className="metadata-item-detail">{item.detail}</span> : null}
          </div>
        ))}

        {hidden > 0 ? (
          <span className="metadata-more">
            and {hidden} more — the full set is cached and available to the migration wizard.
          </span>
        ) : null}
      </div>
    </div>
  )
}

export interface MetadataViewerProps {
  connector: ConnectorDefinition
  metadata: ConnectorMetadata | null
}

export function MetadataViewer({ connector, metadata }: MetadataViewerProps) {
  if (!metadata) {
    return (
      <EmptyState
        title="Nothing discovered yet"
        description={`Save or sync ${connector.name} and its spaces, projects and other objects will be read automatically and cached here.`}
      />
    )
  }

  // Supported categories first: the ones with data are what an administrator
  // came to look at.
  const ordered = [...metadata.collections].sort((a, b) => {
    if (a.supported !== b.supported) return a.supported ? -1 : 1
    return 0
  })

  const defaultOpenKind = ordered.find((collection) => collection.supported && collection.items.length > 0)?.kind

  return (
    <div className="metadata-wrapper">
      <p className="metadata-sync-line">
        Discovered {formatRelativeTime(metadata.syncedAt)}. Cached and reused by every migration —
        there is nothing to load manually.
      </p>

      <Accordion>
        {ordered.map((collection) => (
          <AccordionItem key={collection.kind} value={collection.kind} defaultOpen={collection.kind === defaultOpenKind}>
            <AccordionTrigger>
              <div className="metadata-header-row">
                <span className="metadata-header-label">{collection.label}</span>
                {collection.supported ? (
                  <Badge variant="secondary">{collection.items.length}</Badge>
                ) : (
                  <Badge variant="outline">Not available</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CollectionPanel collection={collection} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
