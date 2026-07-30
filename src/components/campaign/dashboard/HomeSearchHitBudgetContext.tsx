'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import {
  type HomeSearchGroupHitLimits,
  type HomeSearchGroupId,
  type HomeSearchViewportTier,
} from '@/lib/homeSearchHitBudget'

const HomeSearchHitBudgetContext = createContext<HomeSearchGroupHitLimits | null>(null)

export const HomeSearchHitBudgetProvider = ({
  limits,
  children,
}: {
  limits: HomeSearchGroupHitLimits
  children: ReactNode
}) => (
  <HomeSearchHitBudgetContext.Provider value={limits}>
    {children}
  </HomeSearchHitBudgetContext.Provider>
)

export const useHomeSearchHitLimit = (groupId: HomeSearchGroupId): number | undefined => {
  const limits = useContext(HomeSearchHitBudgetContext)
  return limits?.[groupId]
}

const VIEWPORT_TIER_QUERIES: { tier: HomeSearchViewportTier; query: string }[] = [
  { tier: 'desktop', query: '(min-width: 1024px)' },
  { tier: 'tablet', query: '(min-width: 768px)' },
]

const resolveHomeSearchViewportTier = (
  matchesDesktop: boolean,
  matchesTablet: boolean,
): HomeSearchViewportTier => {
  if (matchesDesktop) return 'desktop'
  if (matchesTablet) return 'tablet'
  return 'mobile'
}

const readHomeSearchViewportTier = (): HomeSearchViewportTier => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'mobile'
  }
  return resolveHomeSearchViewportTier(
    window.matchMedia(VIEWPORT_TIER_QUERIES[0].query).matches,
    window.matchMedia(VIEWPORT_TIER_QUERIES[1].query).matches,
  )
}

export const useHomeSearchViewportTier = (): HomeSearchViewportTier => {
  const [tier, setTier] = useState<HomeSearchViewportTier>(readHomeSearchViewportTier)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const desktopMql = window.matchMedia(VIEWPORT_TIER_QUERIES[0].query)
    const tabletMql = window.matchMedia(VIEWPORT_TIER_QUERIES[1].query)

    const sync = () => {
      setTier(resolveHomeSearchViewportTier(desktopMql.matches, tabletMql.matches))
    }

    sync()
    desktopMql.addEventListener('change', sync)
    tabletMql.addEventListener('change', sync)
    return () => {
      desktopMql.removeEventListener('change', sync)
      tabletMql.removeEventListener('change', sync)
    }
  }, [])

  return tier
}
