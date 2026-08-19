"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * `/settings/connections` — the URL the spec asks for.
 *
 * Connections are the Integrations section of the existing Administration
 * Center (`/settings?section=integrations`), which already owns Qlik, Tableau
 * and Fabric connection state. Rather than a second implementation, this
 * route forwards into it so both URLs land on the one connections UI.
 */
export default function SettingsConnectionsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/settings?section=integrations")
  }, [router])

  return null
}
