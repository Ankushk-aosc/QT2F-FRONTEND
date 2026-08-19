"use client"

import React from "react"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface MigrationSourceCardProps {
  name: string
  description: string
  href: string
  /** One or two letters/glyph shown in the icon tile — no external logo dependency. */
  glyph: string
}

/**
 * A source-selection card: "Qlik → Fabric" or "Tableau → Fabric".
 *
 * Routes straight into the existing migration workflow at `href` — it holds no
 * migration logic of its own, only the entry point into it.
 */
export function MigrationSourceCard({ name, description, href, glyph }: MigrationSourceCardProps) {
  return (
    <Card style={{ minWidth: "260px", flex: "1 1 260px", padding: "20px", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--primary-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--primary)",
            flexShrink: 0,
          }}
        >
          {glyph}
        </div>
        <span style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>{name}</span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>{description}</p>
      <Button as="a" href={href}>
        Start {name} Migration
        <ArrowRight size={20} />
      </Button>
    </Card>
  )
}
