"use client"

import React, { useState } from "react"
import { Bell, HelpCircle, LogOut, Menu as MenuIcon, Shuffle } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip } from "@/components/ui/tooltip"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation"
import { useUIStore } from "@/stores/ui.store"

export function TopNavigation() {
  const { user, logout } = useAuth()
  const { workspace, setWorkspace } = useUIStore()
  const router = useRouter()
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const pathname = usePathname()

  const userInitial = user?.name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"

  const userDisplayName = user?.name || user?.email || "User"

  const handleSwitchPlatform = (target: "qlik" | "tableau") => {
    setWorkspace(target)
    if (pathname.startsWith("/migrations")) {
      router.push(`/migrations/${target}`)
    }
  }

  const handleLogout = () => {
    logout()
    setIsUserDropdownOpen(false)
  }

  return (
    <header className="topnav-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {/* Platform Switcher */}
      <div className="topnav-left-section" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--surface-subtle, rgba(0,0,0,0.04))",
            padding: "3px 4px",
            borderRadius: "8px",
            border: "1px solid var(--border, rgba(0,0,0,0.08))",
          }}
        >
          <button
            type="button"
            onClick={() => handleSwitchPlatform("qlik")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: workspace === "qlik" ? 600 : 500,
              background: workspace === "qlik" ? "#009845" : "transparent",
              color: workspace === "qlik" ? "#ffffff" : "var(--text-secondary, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: workspace === "qlik" ? "#ffffff" : "#009845",
              }}
            />
            Qlik Sense
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPlatform("tableau")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: workspace === "tableau" ? 600 : 500,
              background: workspace === "tableau" ? "#e97627" : "transparent",
              color: workspace === "tableau" ? "#ffffff" : "var(--text-secondary, #64748b)",
              transition: "all 0.15s ease",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: workspace === "tableau" ? "#ffffff" : "#e97627",
              }}
            />
            Tableau
          </button>
        </div>
      </div>

      <div className="topnav-right-section">
        <Popover open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="topnav-menu-button" aria-label="Open navigation">
              <MenuIcon size={24} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="topnav-dropdown" style={{ right: 0, left: "auto" }}>
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(pathname, item)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={active ? "topnav-mobile-nav-item topnav-mobile-nav-item-active" : "topnav-mobile-nav-item"}
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  {item.label}
                </Link>
              )
            })}
          </PopoverContent>
        </Popover>

        <Tooltip content="Notifications are not configured for this deployment">
          <button
            type="button"
            className="topnav-icon-button"
            aria-label="Notifications"
            aria-disabled="true"
            disabled
          >
            <Bell size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Help Center is not available yet">
          <button
            type="button"
            className="topnav-icon-button"
            aria-label="Help"
            aria-disabled="true"
            disabled
          >
            <HelpCircle size={18} />
          </button>
        </Tooltip>

        <Popover open={isUserDropdownOpen} onOpenChange={setIsUserDropdownOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="topnav-account" aria-label="Account menu">
              <span className="topnav-avatar">{userInitial}</span>
              <span className="topnav-account-text">
                <span className="topnav-account-name">{userDisplayName}</span>
                {user?.email && user.email !== userDisplayName && (
                  <span className="topnav-account-meta">{user.email}</span>
                )}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent className="topnav-dropdown" style={{ right: 0, left: "auto" }}>
            <div className="topnav-user-info">{userDisplayName}</div>
            <button type="button" className="topnav-menu-item" onClick={handleLogout}>
              <LogOut size={20} />
              Logout
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
