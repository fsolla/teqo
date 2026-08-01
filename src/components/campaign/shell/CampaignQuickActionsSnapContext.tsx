'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import {
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
