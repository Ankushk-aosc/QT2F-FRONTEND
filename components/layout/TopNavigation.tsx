"use client"

import React, { useState } from "react"
import { Bell, HelpCircle, LogOut, Menu as MenuIcon } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip } from "@/components/ui/tooltip"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { NAV_ITEMS, isNavItemActive } from "@/lib/navigation"

/**
 * The content-area header: notifications, help, and the account menu.
 *
 * Primary navigation lives in `AppSidebar` only — this used to repeat the same
 * `NAV_ITEMS` links, which meant two competing navigation systems. The mobile
 * menu below is the exception: the sidebar is hidden under 900px, so the
 * hamburger is the only nav at that width.
 *
 * The bell and help button are deliberately inert: this deployment has no
 * notification feed and no help destination, so they announce that rather than
 * showing a count or linking nowhere. No badge is ever rendered.
 */
export function TopNavigation() {
  const { user, logout } = useAuth()
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const pathname = usePathname()

  const userInitial = user?.name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"

  const userDisplayName = user?.name || user?.email || "User"

  const handleLogout = () => {
    logout()
    setIsUserDropdownOpen(false)
  }

  return (
    <header className="topnav-header">
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
