"use client"

import type React from "react"
import { makeStyles, Spinner } from "@fluentui/react-components"
import { TopNavigation } from "@/components/layout/TopNavigation"
import { LeftSidebar } from "@/components/layout/LeftSidebar"
import { useIsAuthenticated, useMsal } from "@azure/msal-react"
import { InteractionStatus } from "@azure/msal-browser"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AuthSync } from "@/components/AuthSync"
import { useUIStore } from "@/stores/ui.store"

const useStyles = makeStyles({
  layout: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
  },
  content: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    marginTop: "80px",            // ← this pushes content below fixed nav
    "@media (max-width: 767px)": {
      marginTop: "80px",          // slightly less on mobile if needed
    },
  },
  main: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  sidebarContainer: {
    width: "340px",
    transition: "width 0.3s ease-in-out, transform 0.3s ease-in-out",
    overflowX: "hidden",
    flexShrink: 0,
    "&.collapsed": {
      width: "64px",
    },
    "@media (max-width: 767px)": {
      position: "fixed",
      top: "80px", // Align below header
      left: 0,
      bottom: 0,
      zIndex: 45,
      width: "340px",
      transform: "translateX(-100%)",
      "&.open": {
        transform: "translateX(0)",
      },
      "&.collapsed": {
        width: "340px",
      },
    },
  },
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 44,
    display: "none",
    "@media (max-width: 767px)": {
      "&.open": {
        display: "block",
      },
    },
  },
  spinnerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    backgroundColor: "var(--background)",
  },
})

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const styles = useStyles()
  const isAuthenticated = useIsAuthenticated()
  const { inProgress, accounts } = useMsal()
  const router = useRouter()
  const { isSidebarOpen: sidebarOpen, setSidebarOpen } = useUIStore()
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    // On mobile, start with sidebar closed
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [setSidebarOpen])

  useEffect(() => {
    // Wait one stable cycle after MSAL settles before deciding to redirect.
    // This avoids dashboard<->signin bounce loops during token/account hydration.
    if (inProgress !== InteractionStatus.None) {
      setAuthResolved(false)
      return
    }

    const timer = setTimeout(() => {
      setAuthResolved(true)
    }, 250)

    return () => clearTimeout(timer)
  }, [inProgress, accounts.length])

  useEffect(() => {
    // Redirect only when auth is truly unresolved: no authenticated session and no known accounts.
    if (authResolved && !isAuthenticated && inProgress === InteractionStatus.None && accounts.length === 0) {
      router.replace("/signin")
    }
  }, [authResolved, isAuthenticated, inProgress, accounts.length, router])

  if (!authResolved || inProgress !== InteractionStatus.None) {
    return (
      <div className={styles.spinnerContainer}>
        <Spinner size="large" label="Securing your session..." />
      </div>
    )
  }

  if (!isAuthenticated && accounts.length === 0) {
    return (
      <div className={styles.spinnerContainer}>
        <Spinner size="large" label="Securing your session..." />
      </div>
    )
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className={styles.layout}>
      <AuthSync />

      <TopNavigation />

      <div className={styles.content}>
        <div className={`${styles.sidebarContainer} ${sidebarOpen ? "open" : "collapsed"}`}>
          <LeftSidebar onClose={closeSidebar} />
        </div>

        <main className={styles.main}>
          {children}
        </main>
      </div>

      <div 
        className={`${styles.overlay} ${sidebarOpen ? "open" : ""}`}
        onClick={closeSidebar}
      />
    </div>
  )
}