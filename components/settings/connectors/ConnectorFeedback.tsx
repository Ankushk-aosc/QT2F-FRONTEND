"use client"

import React from "react"
import { X } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton, SkeletonItem } from "@/components/ui/skeleton"

/**
 * Feedback states shared across the Integrations surface: result banners,
 * loading skeletons and empty states.
 *
 * Collected here so every connector reports success and failure the same way.
 * The alternative — each panel rolling its own banner — is how a settings area
 * ends up with four visually different ways of saying "that did not work".
 */

// ---------------------------------------------------------------------------
// Result banner
// ---------------------------------------------------------------------------

export interface ResultBannerProps {
  ok: boolean
  message: string
  onDismiss?: () => void
  /** Optional retry, shown only for failures. */
  onRetry?: () => void
}

/**
 * One banner for both outcomes.
 *
 * Success and failure share a component because they share a shape, and because
 * a connector action genuinely has a third outcome — saved but not verified —
 * which the message carries. Splitting into `SuccessBanner` and `ErrorBanner`
 * would force the caller to classify something the server already classified.
 */
export function ResultBanner({ ok, message, onDismiss, onRetry }: ResultBannerProps) {
  return (
    <Alert variant={ok ? "default" : "destructive"} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <AlertTitle>{ok ? "Done" : "Something went wrong"}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        {!ok && onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry} style={{ alignSelf: "flex-start", marginTop: "8px" }}>
            Try again
          </Button>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss message"
          onClick={onDismiss}
          style={{ flexShrink: 0 }}
        >
          <X size={16} />
        </Button>
      ) : null}
    </Alert>
  )
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Placeholder grid shown while connector state loads.
 *
 * Matches the real card's dimensions so the grid does not jump when data
 * arrives — a skeleton that reflows on load is worse than a spinner.
 */
export function ConnectorGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="connector-skeleton-grid" aria-busy="true" aria-label="Loading connectors">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="connector-skeleton-card">
          <div className="connector-skeleton-header">
            <SkeletonItem shape="square" size={40} />
            <SkeletonItem size={16} style={{ width: "55%" }} />
          </div>
          <SkeletonItem size={12} />
          <SkeletonItem size={12} style={{ width: "70%" }} />
          <SkeletonItem size={24} style={{ width: "45%" }} />
        </Skeleton>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="connector-empty">
      <span style={{ fontWeight: 600, fontSize: "var(--text-lg)" }}>{title}</span>
      <span className="connector-empty-text" style={{ fontSize: "var(--text-sm)" }}>
        {description}
      </span>
      {action}
    </div>
  )
}
