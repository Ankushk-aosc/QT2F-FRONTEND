"use client"

import { Button } from "@/components/ui/button"

import { HOME_ROUTE } from "@/lib/navigation"

/**
 * The catch-all for any route Next.js can't match — including protected
 * routes typed by hand. Works whether or not the visitor is signed in: it
 * only offers a way back to Home, which `AuthGuard` sorts out from there.
 */
export default function NotFound() {
  return (
    <div className="error-page">
      <span className="not-found-code">404</span>
      <span style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Page not found</span>
      <span className="error-page-description">
        The page you&apos;re looking for doesn&apos;t exist.
      </span>
      <Button as="a" href={HOME_ROUTE}>
        Go Home
      </Button>
    </div>
  )
}
