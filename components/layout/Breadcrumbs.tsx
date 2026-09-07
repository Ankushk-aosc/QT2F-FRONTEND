import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

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
    <nav className="flex flex-wrap items-center gap-1.5 py-3 text-[14px] text-muted-foreground" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        
        return (
          <React.Fragment key={`${crumb.label}-${index}`}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mx-0.5" />
            )}
            {crumb.href && !isLast ? (
              <Link 
                href={crumb.href} 
                className="flex items-center transition-colors hover:text-foreground hover:bg-surface-subtle px-2 py-1 rounded-md font-medium"
              >
                {index === 0 && crumb.label === "Home" ? <Home className="h-4 w-4" /> : crumb.label}
              </Link>
            ) : (
              <span 
                className={`flex items-center px-2 py-1 rounded-md ${
                  isLast 
                    ? "font-semibold text-foreground bg-primary/5 border border-primary/10 shadow-sm" 
                    : "font-medium"
                }`} 
                aria-current={isLast ? "page" : undefined}
              >
                {index === 0 && crumb.label === "Home" ? <Home className="h-4 w-4" /> : crumb.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
