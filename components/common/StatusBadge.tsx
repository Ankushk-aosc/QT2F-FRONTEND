"use client"

import React from "react"
import { Badge, type BadgeProps } from "@/components/ui/badge"

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  completed: "success",
  success: "success",
  succeeded: "success",
  failed: "destructive",
  error: "destructive",
  running: "default",
  in_progress: "default",
  processing: "default",
  pending: "secondary",
  queued: "secondary",
  cancelled: "warning",
  canceled: "warning",
}

function toLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** A migration/run status rendered consistently wherever a run status is shown. */
export function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase()
  const variant = STATUS_VARIANT[normalized] ?? "secondary"
  return <Badge variant={variant}>{toLabel(status || "Unknown")}</Badge>
}
