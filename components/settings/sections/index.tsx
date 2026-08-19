"use client"

import React from "react"

import { getSection, type SettingsSectionId } from "@/lib/settings/navigation"

import { AboutSection } from "./AboutSection"
import { AppearanceSection } from "./AppearanceSection"
import { GeneralSection } from "./GeneralSection"
import { IntegrationsSection } from "./IntegrationsSection"
import { MigrationSection } from "./MigrationSection"
import { PlannedSection } from "./PlannedSection"
import { WorkspaceSection } from "./WorkspaceSection"

/**
 * Maps a section id to its implementation.
 *
 * Sections absent from this map are declared in the navigation registry but not
 * built yet, and fall through to `PlannedSection`. Implementing one is a matter
 * of adding an entry here and flipping its `status` to "available".
 */
const IMPLEMENTED_SECTIONS: Partial<Record<SettingsSectionId, React.ComponentType>> = {
  general: GeneralSection,
  appearance: AppearanceSection,
  workspace: WorkspaceSection,
  migration: MigrationSection,
  integrations: IntegrationsSection,
  about: AboutSection,
}

export function SettingsSectionRouter({ sectionId }: { sectionId: SettingsSectionId }) {
  const Implementation = IMPLEMENTED_SECTIONS[sectionId]
  if (Implementation) {
    return <Implementation />
  }

  const section = getSection(sectionId)
  if (!section) return null

  return <PlannedSection section={section} />
}
