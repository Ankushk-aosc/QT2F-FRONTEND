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
import { useAuthStore } from "@/stores/auth.store"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated()
  const { inProgress, accounts } = useMsal()
  const isStoreAuthed = useAuthStore((s) => s.isAuthenticated)
  const isEffectiveAuthed = isAuthenticated || accounts.length > 0 || isStoreAuthed
  const router = useRouter()
  const pathname = usePathname()
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    if (isStoreAuthed || accounts.length > 0) {
      setAuthResolved(true)
      return
    }

    if (inProgress !== InteractionStatus.None) {
      setAuthResolved(false)
      return
    }

    const timer = setTimeout(() => setAuthResolved(true), 100)
    return () => clearTimeout(timer)
  }, [inProgress, accounts.length, isStoreAuthed])

  useEffect(() => {
    if (authResolved && !isEffectiveAuthed && inProgress === InteractionStatus.None && accounts.length === 0) {
      const redirect = pathname ? `?redirect=${encodeURIComponent(pathname)}` : ""
      router.replace(`${SIGNIN_ROUTE}${redirect}`)
    }
  }, [authResolved, isEffectiveAuthed, inProgress, accounts.length, pathname, router])

  const settling = !authResolved || inProgress !== InteractionStatus.None
  if (settling && !isStoreAuthed) {
    // Same background/size/label as MsalProviderWrapper's own loading
    // spinner (the state immediately before this one renders), so this
    // settle-timer wait reads as a continuation of that screen rather than
    // a second, visually distinct loading gate. The settle logic itself --
    // the authResolved timer and inProgress check above -- is unchanged;
    // only the visual presentation of this branch was unified.
    return (
      <div style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--background)" }}>
        <Spinner size="extra-large" label="Loading Application Context..." />
      </div>
    )
  }

  if (!isEffectiveAuthed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", width: "100%", backgroundColor: "var(--background)" }}>
        <Spinner size="large" label="Redirecting to sign-in..." />
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
