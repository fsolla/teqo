'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { HomeSearchController } from '@/components/campaign/dashboard/useHomeSearchQuery'

export type HomeSearchContextValue = HomeSearchController

const HomeSearchContext = createContext<HomeSearchContextValue | null>(null)

export const HomeSearchProvider = ({
  value,
  children,
}: {
  value: HomeSearchContextValue
  children: ReactNode
}) => <HomeSearchContext.Provider value={value}>{children}</HomeSearchContext.Provider>

export const useHomeSearch = (): HomeSearchContextValue => {
  const ctx = useContext(HomeSearchContext)
  if (!ctx) {
    throw new Error('useHomeSearch must be used within HomeSearchProvider')
  }
  return ctx
}
