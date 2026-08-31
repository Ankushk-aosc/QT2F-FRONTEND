'use client'

import React from 'react'
import MsalProviderWrapper from './MsalProviderWrapper'
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings'

function AppearanceEffects() {
  useAppearanceSettings()
  return null
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppearanceEffects />
      <MsalProviderWrapper>{children}</MsalProviderWrapper>
    </>
  )
}
