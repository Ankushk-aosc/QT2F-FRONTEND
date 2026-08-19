"use client"

import React from "react"

import { Breadcrumbs } from "./Breadcrumbs"

interface PageHeaderProps {
  title: string
  subtitle?: string
  /** Page-level actions, rendered to the right of the title. */
  actions?: React.ReactNode
}

/**
 * The heading every authenticated page opens with: breadcrumb trail, title,
 * optional subtitle and actions. Pages no longer draw their own title bars, so
 * they line up with each other by construction.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-title-block">
        <Breadcrumbs />
        <span className="page-header-title">{title}</span>
        {subtitle && <span className="page-header-subtitle">{subtitle}</span>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
