// components/AuthSync.tsx
"use client"

import { useEffect } from "react"
import { useMsal } from "@azure/msal-react"
import { useAuthStore } from "@/stores/auth.store"

export function AuthSync() {
  const { accounts } = useMsal()

  useEffect(() => {
    const account = accounts[0]

    if (!account) {
      // Optional: clear store when no account is active
      // useAuthStore.getState().logout()
      return
    }

    // Try different places where email might be stored
    let email =
      (account.idTokenClaims?.email as string | undefined) ||
      (account.idTokenClaims?.preferred_username as string | undefined) ||
      account.username ||
      ""

    email = typeof email === 'string' ? email.trim() : "";

    if (!email) {
      console.warn("[AuthSync] No email found in MSAL account", account)
      return
    }

    const current = useAuthStore.getState()

    // Avoid unnecessary updates
    if (!current.isAuthenticated || current.user?.email !== email) {
      console.log("[AuthSync] Syncing user from MSAL →", email)

      current.login(email, account.name || undefined)
    }
  }, [accounts])

  return null
}