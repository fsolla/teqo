'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import {
  QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX,
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_DOCK,
  quickActionsSnapIsDock,
  type QuickActionsSnapPoint,
} from '@/lib/campaignQuickActionSnap'

type CampaignQuickActionsSnapContextValue = {
  snapPoint: QuickActionsSnapPoint | null
  setSnapPoint: Dispatch<SetStateAction<QuickActionsSnapPoint | null>>
  isDock: boolean
}

const CampaignQuickActionsSnapContext = createContext<CampaignQuickActionsSnapContextValue | null>(
  null,
)

export const CampaignQuickActionsSnapProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const [snapPoint, setSnapPoint] = useState<QuickActionsSnapPoint | null>(QUICK_ACTIONS_SNAP_DOCK)

  useEffect(() => {
    setSnapPoint(QUICK_ACTIONS_SNAP_DOCK)
  }, [pathname])

  const value = useMemo(
    (): CampaignQuickActionsSnapContextValue => ({
      snapPoint,
      setSnapPoint,
      isDock: quickActionsSnapIsDock(snapPoint),
    }),
    [snapPoint],
  )

  return (
    <CampaignQuickActionsSnapContext.Provider value={value}>
      {children}
    </CampaignQuickActionsSnapContext.Provider>
  )
}

export const useCampaignQuickActionsSnap = (): CampaignQuickActionsSnapContextValue => {
  const value = useContext(CampaignQuickActionsSnapContext)
  if (!value) {
    throw new Error('CampaignQuickActionsSnapProvider is required')
  }
  return value
}

/** Collapses the dock when the main content scrollport moves down past the threshold. */
export const CampaignQuickActionsScrollCollapse = () => {
  const { setSnapPoint } = useCampaignQuickActionsSnap()
  const { uiFocused } = useHomeSearch()

  const collapseIfScrolled = useCallback(() => {
    if (uiFocused) return

    const scrollport = document.querySelector('[data-slot="campaign-content-scroll"]')
    if (!(scrollport instanceof HTMLElement)) return

    if (scrollport.scrollTop > QUICK_ACTIONS_SCROLL_COLLAPSE_THRESHOLD_PX) {
      setSnapPoint(QUICK_ACTIONS_SNAP_COLLAPSED)
    }
  }, [setSnapPoint, uiFocused])

  useEffect(() => {
    const scrollport = document.querySelector('[data-slot="campaign-content-scroll"]')
    if (!(scrollport instanceof HTMLElement)) return

    scrollport.addEventListener('scroll', collapseIfScrolled, { passive: true })
    return () => {
      scrollport.removeEventListener('scroll', collapseIfScrolled)
    }
  }, [collapseIfScrolled])

  return null
}
