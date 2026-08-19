"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { buildBreadcrumbs } from "@/lib/navigation"

/**
 * The trail from Home to the current page.
 *
 * Derives itself from the pathname, so pages do not declare their own trail and
 * cannot drift from where they actually sit in the route tree.
 */
export function Breadcrumbs() {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname)

  if (crumbs.length <= 1) return null

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && (
            <span className="breadcrumbs-separator" aria-hidden="true">
              /
            </span>
          )}
          {crumb.href ? (
            <Link href={crumb.href} className="breadcrumbs-link">
              {crumb.label}
            </Link>
          ) : (
            <span className="breadcrumbs-current" aria-current="page">
              {crumb.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
