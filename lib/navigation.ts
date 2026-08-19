/**
 * The application's one navigation definition.
 *
 * Every place that needs to know "what are the top-level destinations" — the
 * sidebar, the mobile drawer, the breadcrumb trail, the not-found page — reads
 * from here. Adding a destination is a single edit; it used to mean touching
 * each component that hardcoded the same list of routes.
 */

export const HOME_ROUTE = "/dashboard"
export const SIGNIN_ROUTE = "/signin"

export type NavItemId = "home" | "migrations" | "monitoring" | "run-history" | "settings"

export interface NavItem {
  id: NavItemId
  label: string
  href: string
  /** Longer description, used by the mobile drawer and the not-found page. */
  description: string
}

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: HOME_ROUTE,
    description: "Migration overview and recent activity",
  },
  {
    id: "migrations",
    label: "Migrations",
    href: "/migrations",
    description: "Start a Qlik or Tableau migration to Microsoft Fabric",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    href: "/monitoring",
    description: "Live agent activity for in-flight runs",
  },
  {
    id: "run-history",
    label: "Run History",
    href: "/run-history",
    description: "Completed and failed runs, with their results",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description: "Administration Center — connections and platform defaults",
  },
] as const

/**
 * Whether a nav item represents the page currently shown.
 *
 * Home matches only itself: `/dashboard` is a leaf, and prefix-matching it would
 * light up nothing else anyway. Every other item prefix-matches so that
 * `/migrations/tableau` keeps "Migrations" selected.
 */
export function isNavItemActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname) return false
  if (item.href === HOME_ROUTE) return pathname === HOME_ROUTE
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export interface Crumb {
  label: string
  /** Absent on the final crumb — you are already there. */
  href?: string
}

/** Labels for path segments that are not themselves a nav item. */
const SEGMENT_LABELS: Record<string, string> = {
  qlik: "Qlik",
  tableau: "Tableau",
  connections: "Connections",
}

/**
 * The breadcrumb trail for a path, always rooted at Home.
 *
 * Derived from the URL rather than declared per page, so a new route under an
 * existing section gets a correct trail without registering anything.
 */
export function buildBreadcrumbs(pathname: string | null): Crumb[] {
  if (!pathname || pathname === HOME_ROUTE) {
    return [{ label: "Home" }]
  }

  const crumbs: Crumb[] = [{ label: "Home", href: HOME_ROUTE }]
  const segments = pathname.split("/").filter(Boolean)

  segments.forEach((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    const navItem = NAV_ITEMS.find((item) => item.href === href)
    const label = navItem?.label ?? SEGMENT_LABELS[segment] ?? toTitleCase(segment)
    const isLast = index === segments.length - 1
    crumbs.push(isLast ? { label } : { label, href })
  })

  return crumbs
}

function toTitleCase(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
