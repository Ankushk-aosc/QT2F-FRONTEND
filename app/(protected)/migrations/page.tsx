"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { useUIStore } from "@/stores/ui.store"

const PLATFORMS = [
  {
    id: "qlik",
    href: "/migrations/qlik",
    letter: "Q",
    color: "#009845",
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
    id: "tableau",
    href: "/migrations/tableau",
    letter: "T",
    color: "#e97627",
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
] as const

export default function MigrationsPage() {
  const setWorkspace = useUIStore((state) => state.setWorkspace)

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <PageHeader
        title="Migration Platform Selection"
        subtitle="Choose your source platform to launch an automated migration to Microsoft Fabric."
      />

      <div className="mt-8 grid grid-cols-1 gap-7 md:grid-cols-2">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-8 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: `linear-gradient(180deg, var(--surface) 0%, ${platform.color}08 100%)` }}
          >
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div
                  className="flex h-[52px] w-[52px] items-center justify-center rounded-xl text-2xl font-extrabold text-white"
                  style={{ background: platform.color, boxShadow: `0 4px 12px ${platform.color}4d` }}
                >
                  {platform.letter}
                </div>
                <Badge
                  variant="secondary"
                  className="font-semibold"
                  style={{ background: `${platform.color}1f`, color: platform.color, border: "none" }}
                >
                  {platform.badge}
                </Badge>
              </div>

              <h2 className="mb-2.5 text-xl font-bold text-foreground">{platform.title}</h2>
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{platform.description}</p>

              <div className="mb-7 flex flex-col gap-2.5">
                {platform.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-[13px] text-secondary-foreground">
                    <CheckCircle2 size={16} style={{ color: platform.color }} className="shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={platform.href}
              onClick={() => setWorkspace(platform.id)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
