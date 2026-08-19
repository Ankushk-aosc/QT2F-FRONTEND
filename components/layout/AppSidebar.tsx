"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  History,
  Home,
  LifeBuoy,
  Settings as SettingsIcon,
  ShieldCheck,
  Shuffle,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation"
import { useSettingsStore } from "@/stores/settings.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { Badge } from "@/components/ui/badge"
import { Tooltip } from "@/components/ui/tooltip"
import { SystemHealthCard } from "@/components/common/SystemHealthCard"

const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  migrations: Shuffle,
  monitoring: Activity,
  "run-history": History,
  settings: SettingsIcon,
}

/**
 * Secondary destinations shown below the main nav.
 *
 * Neither has a route or backing feature in this deployment, so both render as
 * explicitly unavailable rather than as links to nowhere — the same `Soon`
 * convention the settings rail already uses for unbuilt sections.
 */
const SECONDARY_ITEMS: ReadonlyArray<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "help-center", label: "Help Center", icon: LifeBuoy },
  { id: "system-status", label: "System Status", icon: ShieldCheck },
]

interface AppSidebarProps {
  /**
   * Icon-only rail instead of the full labeled sidebar. Used on routes that
   * also show the workspace (source/workbook) sidebar, so the two don't
   * compete for width — labels move to `title` tooltips, so every link and
   * action stays reachable and named for assistive tech, just not spelled
   * out visually.
   */
  compact?: boolean
}

/**
 * The persistent product navigation rail shown on every authenticated page.
 *
 * Reads the same `NAV_ITEMS` / `isNavItemActive` the breadcrumbs and the mobile
 * menu use, so it never drifts out of sync with real routes. Quick actions link
 * straight into the existing Qlik/Tableau migration routes — no new workflow,
 * just a second entry point into the one that already exists.
 *
 * Also honors the administrator's "Sidebar style" preference from Appearance
 * settings (`expanded` / `compact` / `overlay`).
 */
export function AppSidebar({ compact: compactForRoute = false }: AppSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const sidebarStyle = useSettingsStore((state) => state.settings.appearance.sidebarStyle)
  const isProcessing = useDashboardStore((state) => state.isProcessing)

  const compact = compactForRoute || sidebarStyle === "compact"
  const overlay = sidebarStyle === "overlay"

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"
  const userDisplayName = user?.name || user?.email || "User"

  const className = ["app-sidebar", compact && "app-sidebar-compact", overlay && "app-sidebar-overlay"]
    .filter(Boolean)
    .join(" ")

  const label = (text: string) => (
    <span className={compact ? "app-sidebar-visually-hidden" : undefined}>{text}</span>
  )

  return (
    <aside className={className} aria-label="Primary">
      <div className="app-sidebar-brand">
        <Link href="/dashboard" aria-label="Switchblade home">
          <Image
            src="/Switchblade_Logo.png"
            alt="Switchblade"
            width={360}
            height={65}
            className="app-sidebar-logo"
            priority
          />
        </Link>
      </div>

      <nav className="app-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item)
          const Icon = NAV_ICONS[item.id] ?? Home
          // A migration in progress locks Settings so the connections it is
          // using cannot be edited out from under it mid-run.
          const locked = item.id === "settings" && isProcessing

          if (locked) {
            return (
              <Tooltip key={item.id} content="Settings are locked while a migration is in progress">
                <span className="app-sidebar-link app-sidebar-link-locked" aria-disabled="true">
                  <Icon size={18} />
                  {label(item.label)}
                </span>
              </Tooltip>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={active ? "app-sidebar-link app-sidebar-link-active" : "app-sidebar-link"}
              aria-current={active ? "page" : undefined}
              title={compact ? item.label : undefined}
            >
              <Icon size={18} />
              {label(item.label)}
            </Link>
          )
        })}
      </nav>

      <div className="app-sidebar-section">
        <span className={compact ? "app-sidebar-visually-hidden" : "app-sidebar-section-title"}>
          Quick Actions
        </span>
        <Link
          href="/migrations/qlik"
          className="app-sidebar-quick-action"
          title={compact ? "New Qlik Migration" : undefined}
        >
          <span className="app-sidebar-quick-action-glyph">Q</span>
          {label("New Qlik Migration")}
        </Link>
        <Link
          href="/migrations/tableau"
          className="app-sidebar-quick-action"
          title={compact ? "New Tableau Migration" : undefined}
        >
          <span className="app-sidebar-quick-action-glyph">T</span>
          {label("New Tableau Migration")}
        </Link>
      </div>

      <div className="app-sidebar-secondary">
        {SECONDARY_ITEMS.map(({ id, label: itemLabel, icon: Icon }) => (
          <Tooltip key={id} content={`${itemLabel} is not available yet`}>
            <span className="app-sidebar-link app-sidebar-link-planned" aria-disabled="true">
              <Icon size={18} />
              {label(itemLabel)}
              {!compact && (
                <Badge variant="outline" className="app-sidebar-soon">
                  Soon
                </Badge>
              )}
            </span>
          </Tooltip>
        ))}
      </div>

      {!compact && <SystemHealthCard />}

      {user && (
        <div className="app-sidebar-user" title={compact ? userDisplayName : undefined}>
          <span className="app-sidebar-user-avatar">{userInitial}</span>
          <span className={compact ? "app-sidebar-visually-hidden" : "app-sidebar-user-text"}>
            <span className="app-sidebar-user-name">{userDisplayName}</span>
            {user.email && user.email !== userDisplayName && (
              <span className="app-sidebar-user-meta">{user.email}</span>
            )}
          </span>
        </div>
      )}
    </aside>
  )
}
