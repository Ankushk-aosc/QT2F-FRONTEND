"use client"

import React from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import { MigrationSourceCard } from "@/components/dashboard/MigrationSourceCard"

/**
 * `/migrations` — pick a source before configuring a migration.
 *
 * Deliberately just the two cards: the actual configuration lives at
 * `/migrations/qlik` and `/migrations/tableau`, which this page routes into.
 */
export default function MigrationsPage() {
  return (
    <div className="migrations-page">
      <PageHeader title="Migrations" subtitle="Choose a source to configure and start a migration." />
      <div className="migrations-page-body">
        <MigrationSourceCard
          name="Qlik"
          description="Qlik Sense → Microsoft Fabric"
          href="/migrations/qlik"
          glyph="Q"
        />
        <MigrationSourceCard
          name="Tableau"
          description="Tableau → Microsoft Fabric"
          href="/migrations/tableau"
          glyph="T"
        />
      </div>
    </div>
  )
}
