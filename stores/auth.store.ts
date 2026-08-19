// stores/auth.store.ts
"use client"

import { create } from "zustand"

/**
 * The application's view of the signed-in user.
 *
 * This store is a *projection* of the MSAL session, not a second source of
 * truth. `AuthSync` writes it from the active MSAL account on every account
 * change, and the protected layout decides what is authenticated by asking
 * MSAL directly.
 *
 * It deliberately does not persist.
 *
 * An earlier version wrote the user to `localStorage["auth"]` and re-hydrated
 * `isAuthenticated: true` from it at module load. That made a value an attacker
 * (or the user) could edit in devtools into the app's notion of who was signed
 * in, and it survived sign-out in another tab. Identity now lives exactly one
 * place — the MSAL token — and this store is repopulated from it on each load.
 * Nothing here is authorisation: the backend authorises on the bearer token.
 */

interface User {
  email: string
  name: string
  initials: string
}

interface AuthStore {
  isAuthenticated: boolean
  user: User | null
  login: (email: string, name?: string) => void
  logout: () => void
}

/** "Ada Lovelace" → "AL"; "ada.lovelace@x.com" → "AL". */
function toInitials(name: string): string {
  return name
    .split(/[\s.]+/)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")
    .substring(0, 2)
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  user: null,

  login: (email: string, name?: string) => {
    if (!email?.trim()) {
      console.warn("[Auth Store] Login attempted with empty email")
      return
    }

    const finalName = name || email.split("@")[0]

    set({
      isAuthenticated: true,
      user: {
        email: email.trim(),
        name: finalName,
        initials: toInitials(finalName),
      },
    })
  },

  logout: () => set({ isAuthenticated: false, user: null }),
}))
