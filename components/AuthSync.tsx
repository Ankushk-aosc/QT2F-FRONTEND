// components/AuthSync.tsx
"use client"

import { useEffect } from "react"
import { useMsal } from "@azure/msal-react"
import { useAuthStore } from "@/stores/auth.store"

/**
 * Projects the active MSAL account into `auth.store`.
 *
 * This is the only writer of the auth store, which is what keeps MSAL the
 * single source of identity. Mounted once, in the protected layout.
 */
export function AuthSync() {
  const { accounts } = useMsal()

  useEffect(() => {
    const account = accounts[0]
    const { isAuthenticated, user, login, logout } = useAuthStore.getState()

    // No account — the session ended (sign-out, expiry, or another tab).
    // Clearing here stops a stale user lingering in the UI after MSAL has
    // already dropped the session.
    if (!account) {
      if (isAuthenticated) logout()
      return
    }

    const email = (
      (account.idTokenClaims?.email as string | undefined) ||
      (account.idTokenClaims?.preferred_username as string | undefined) ||
      account.username ||
      ""
    ).trim()

    if (!email) {
      console.warn("[AuthSync] MSAL account carries no email claim")
      return
    }

    if (!isAuthenticated || user?.email !== email) {
      login(email, account.name || undefined)
    }
  }, [accounts])

  return null
}
