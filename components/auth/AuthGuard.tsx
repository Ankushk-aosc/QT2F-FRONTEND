"use client"

import React, { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useIsAuthenticated, useMsal } from "@azure/msal-react"
import { InteractionStatus } from "@azure/msal-browser"
import { Spinner } from "@/components/ui/spinner"

import { AuthSync } from "@/components/AuthSync"
import { SIGNIN_ROUTE } from "@/lib/navigation"

/**
 * The single place the application decides whether someone may see a protected
 * page.
 *
 * This logic used to live inside the protected layout, which meant any new
 * shell or route group would have had to copy it. It is unchanged MSAL: the
 * session is whatever `@azure/msal-react` says it is, and nothing here mints,
 * stores or infers identity of its own.
 *
 * The one subtlety worth keeping is the settle delay. MSAL reports
 * `InteractionStatus.None` briefly before it has rehydrated accounts from the
 * cache, and redirecting in that window bounced authenticated users to sign-in
 * and straight back. So the guard waits for one stable cycle before treating
 * "no account" as "not signed in".
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress, accounts } = useMsal()
  const router = useRouter()
  const pathname = usePathname()
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) {
      setAuthResolved(false)
      return
    }

    const timer = setTimeout(() => setAuthResolved(true), 250)
    return () => clearTimeout(timer)
  }, [inProgress, accounts.length])

  useEffect(() => {
    if (authResolved && !isAuthenticated && inProgress === InteractionStatus.None && accounts.length === 0) {
      // Carry the attempted path so sign-in can return them to it rather than
      // dropping everyone on the dashboard.
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : ""
      router.replace(`${SIGNIN_ROUTE}${redirect}`)
    }
  }, [authResolved, isAuthenticated, inProgress, accounts.length, pathname, router])

  const settling = !authResolved || inProgress !== InteractionStatus.None
  if (settling || (!isAuthenticated && accounts.length === 0)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", width: "100%", backgroundColor: "var(--background)" }}>
        <Spinner size="large" label="Securing your session..." />
      </div>
    )
  }

  return (
    <>
      <AuthSync />
      {children}
    </>
  )
}
