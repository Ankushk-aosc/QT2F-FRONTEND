"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Spinner } from "@/components/ui/spinner"

/**
 * A full-screen loading overlay shown for the moment between clicking a link
 * and the destination route finishing its render.
 *
 * Next's App Router prefetches most in-viewport `<Link>`s, so a same-tab
 * click usually resolves fast enough that nothing visible happened between
 * "click" and "new page" — which reads as an unresponsive app on a slower
 * connection or a route that wasn't prefetched. This makes that gap visible
 * instead of silent: any left-click on a same-origin, same-tab `<a>` (which
 * is what `<Link>` renders to) flips the overlay on immediately, and the
 * `pathname`/`searchParams` change effect flips it back off once the new
 * route has actually mounted.
 *
 * Deliberately does not intercept `router.push()` calls made without a
 * backing `<a>` element (a handful of history-drilldown buttons) — those are
 * few enough, and fast enough locally, that hooking them isn't worth the
 * extra surface area.
 */
export function RouteTransitionOverlay() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const currentKey = `${pathname}?${searchParams.toString()}`
  const previousKey = useRef(currentKey)

  useEffect(() => {
    if (currentKey !== previousKey.current) {
      previousKey.current = currentKey
      setLoading(false)
    }
  }, [currentKey])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only a plain left-click with no modifier — anything else (middle
      // click, ctrl/cmd+click, shift+click) opens a new tab/window and never
      // reaches this page, so the overlay would be left stuck on.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as HTMLElement | null)?.closest("a")
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === pathname && url.search === (searchParams.toString() ? `?${searchParams.toString()}` : "")) return

      setLoading(true)
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [pathname, searchParams])

  if (!loading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
      <Spinner size="extra-large" label="Loading..." />
    </div>
  )
}
