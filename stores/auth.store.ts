// stores/auth.store.ts
"use client"

import { create } from "zustand"

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

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: false,
  user: null,

  login: (email: string, name?: string) => {
    if (!email?.trim()) {
      console.warn("[Auth Store] Login attempted with empty email")
      return
    }

    const finalName = name || email.split("@")[0]
    const initials = finalName
      .split(/[\s.]+/)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .substring(0, 2)

    const userData: User = {
      email: email.trim(),
      name: finalName,
      initials,
    }

    console.log("[Auth Store] LOGIN SUCCESS:", userData)

    set({
      isAuthenticated: true,
      user: userData,
    })

    if (typeof window !== "undefined") {
      localStorage.setItem("auth", JSON.stringify(userData))
    }
  },

  logout: () => {
    console.log("[Auth Store] LOGOUT")
    set({ isAuthenticated: false, user: null })
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth")
    }
  },
}))

// Hydrate from localStorage
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("auth")
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as User
      if (parsed?.email?.trim()) {
        useAuthStore.setState({ isAuthenticated: true, user: parsed })
        console.log("[Auth Store] Restored from localStorage:", parsed.email)
      } else {
        localStorage.removeItem("auth")
      }
    } catch (err) {
      console.error("[Auth Store] Invalid auth data in localStorage", err)
      localStorage.removeItem("auth")
    }
  }
}