"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { AuthGuard } from "@/components/auth/AuthGuard"
import { TopNavigation } from "@/components/layout/TopNavigation"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { LeftSidebar } from "@/components/layout/LeftSidebar"
import { useUIStore } from "@/stores/ui.store"

/**
 * Routes where the source/workbook tree is meaningful context, not clutter.
 *
 * `/monitoring` and `/run-history` are deliberately absent: they are now
 * dedicated overview pages rather than views of one in-flight migration, so the
 * workbook tree would compete with their own content. The tree still appears on
 * the migration workspace itself, where a selection is being made.
 */
function needsWorkspaceSidebar(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith("/migrations/qlik") || pathname.startsWith("/migrations/tableau")
}

/**
 * The one application shell every authenticated page renders inside.
 *
 * Composes the auth gate, the top navigation and the contextual workspace
 * sidebar (shown only where a source/workbook selection is meaningful — the
 * dashboard and Settings are full-width). Pages stop declaring their own
 * header, sidebar and auth check; they render inside this shell as `children`.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isSidebarOpen: sidebarOpen, setSidebarOpen } = useUIStore()
  const showWorkspaceSidebar = needsWorkspaceSidebar(pathname)

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [setSidebarOpen])

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <AuthGuard>
      <div className="app-shell-layout">
        <AppSidebar compact={showWorkspaceSidebar} />

        <div className="app-shell-body">
          <TopNavigation />

          <div className="app-shell-content">
            {showWorkspaceSidebar && (
              <div className={`app-shell-sidebar-container ${sidebarOpen ? "open" : "collapsed"}`}>
                <LeftSidebar onClose={closeSidebar} />
              </div>
            )}

            <main className="app-shell-main">{children}</main>
          </div>
        </div>

        {showWorkspaceSidebar && (
          <div
            className={`app-shell-overlay ${sidebarOpen ? "open" : ""}`}
            onClick={closeSidebar}
          />
        )}
      </div>
    </AuthGuard>
  )
}
