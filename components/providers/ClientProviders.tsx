'use client'
 
import React from 'react'
import {
  createDOMRenderer,
  RendererProvider,
  SSRProvider,
  FluentProvider,
  webLightTheme,
  webDarkTheme,
} from '@fluentui/react-components'
import MsalProviderWrapper from './MsalProviderWrapper'
import { useUIStore } from '@/stores/ui.store'
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
  const theme = useUIStore((s) => s.theme)
 
  // Create renderer only once on client
  const renderer = React.useMemo(() => createDOMRenderer(), [])
 
  // During SSR or first render → nothing / fallback (avoids canUseDOM calls too early)
  if (!isMounted) {
    return <>{children}</> // or a minimal placeholder
  }
 
  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={theme === 'dark' ? webDarkTheme : webLightTheme}>
          <AppearanceEffects />
          <MsalProviderWrapper>{children}</MsalProviderWrapper>
        </FluentProvider>
      </SSRProvider>
    </RendererProvider>
  )
}