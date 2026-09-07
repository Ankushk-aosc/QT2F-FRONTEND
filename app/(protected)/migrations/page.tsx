"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { useUIStore } from "@/stores/ui.store"

const PLATFORMS = [
  {
    id: "qlik" as const,
    href: "/migrations/qlik",
    logo: "/qliklogo.png",
    logoAlt: "Qlik Sense",
    color: "#009845",
    colorLight: "#e6f7ee",
    colorGlow: "rgba(0, 152, 69, 0.15)",
    badge: "Qlik Sense → Fabric",
    title: "Qlik Sense Migration",
    description:
      "Seamlessly migrate Qlik Sense Cloud and Qlik Server apps, load scripts, and sheets into native Power BI TMDL semantic models and reports.",
    features: [
      "Automated Feasibility Assessment & Complexity Scoring",
      "Set Analysis & Expressions translated to DAX / M Queries",
      "Direct Fabric Workspace & Git PBIP Repository Deployment",
    ],
    cta: "Start Qlik Migration",
  },
  {
    id: "tableau" as const,
    href: "/migrations/tableau",
    logo: "/tableau_logo_custom.jpg",
    logoAlt: "Tableau",
    color: "#e97627",
    colorLight: "#fef3eb",
    colorGlow: "rgba(233, 118, 39, 0.15)",
    badge: "Tableau → Fabric",
    title: "Tableau Migration",
    description:
      "Convert Tableau Server & Cloud workbooks, calculations, and data sources into Microsoft Fabric Lakehouses, Semantic Models, and Reports.",
    features: [
      "XML Workbook & Hyper Data Source Extraction",
      "LOD Calculations & Table Calculations converted to DAX",
      "End-to-End Automated Fabric Pipeline & Validation",
    ],
    cta: "Start Tableau Migration",
  },
]

export default function MigrationsPage() {
  const setWorkspace = useUIStore((state) => state.setWorkspace)

  return (
    <div className="mig-select-root">
      <PageHeader
        title="Migration Platform Selection"
        subtitle="Choose your source platform to launch an automated migration to Microsoft Fabric."
      />

      <div className="mig-select-grid">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="mig-select-card"
            style={{
              "--card-color": platform.color,
              "--card-color-light": platform.colorLight,
              "--card-color-glow": platform.colorGlow,
            } as React.CSSProperties}
          >
            {/* Header row: Logo + Badge */}
            <div className="mig-select-card-header">
              <div className="mig-select-logo-wrap">
                <Image
                  src={platform.logo}
                  alt={platform.logoAlt}
                  width={40}
                  height={40}
                  className="mig-select-logo-img"
                />
              </div>
              <Badge
                variant="secondary"
                className="mig-select-badge"
                style={{
                  background: `${platform.color}14`,
                  color: platform.color,
                  border: `1px solid ${platform.color}30`,
                }}
              >
                <Sparkles size={12} style={{ marginRight: 4, opacity: 0.7 }} />
                {platform.badge}
              </Badge>
            </div>

            {/* Title + Description */}
            <h2 className="mig-select-title">{platform.title}</h2>
            <p className="mig-select-desc">{platform.description}</p>

            {/* Feature list */}
            <div className="mig-select-features">
              {platform.features.map((feature) => (
                <div key={feature} className="mig-select-feature-row">
                  <CheckCircle2
                    size={16}
                    className="mig-select-feature-icon"
                    style={{ color: platform.color }}
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Destination row: Fabric logo */}
            <div className="mig-select-dest">
              <Image
                src="/Fabric_Color_48.svg"
                alt="Microsoft Fabric"
                width={20}
                height={20}
              />
              <span>Powered by Microsoft Fabric</span>
            </div>

            {/* CTA */}
            <Link
              href={platform.href}
              onClick={() => setWorkspace(platform.id)}
              className="mig-select-cta"
              style={{ background: platform.color }}
            >
              {platform.cta}
              <ArrowRight size={18} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
