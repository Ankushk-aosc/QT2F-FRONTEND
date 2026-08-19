'use client'

import React from 'react'
import MsalProviderWrapper from './MsalProviderWrapper'
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings'

// Optional: prevent double-rendering flashes (common in dev)
const useIsMounted = () => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

/**
 * Applies the administrator's appearance settings (font scale, motion, density)
 * to the document and keeps "system" theme in sync with the OS.
 *
 * This lives in its own component so the hook is only mounted once the client
 * tree has mounted, without making the hook call conditional.
 */
const AppearanceEffects = () => {
  useAppearanceSettings()
  return null
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  const isMounted = useIsMounted()

  // During SSR or first render → nothing / fallback (avoids canUseDOM calls too early)
  if (!isMounted) {
    return <>{children}</> // or a minimal placeholder
  }

  return (
    <>
      <AppearanceEffects />
      <MsalProviderWrapper>{children}</MsalProviderWrapper>
    </>
  )
}