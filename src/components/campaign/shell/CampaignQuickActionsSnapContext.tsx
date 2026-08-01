'use client'

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import {
  QUICK_ACTIONS_SNAP_DOCK,
  quickActionsSnapIsDock,
  quickActionsSnapIsFull,
  type QuickActionsSnapPoint,
} from '@/lib/campaignQuickActionSnap'

type CampaignQuickActionsSnapContextValue = {
  snapPoint: QuickActionsSnapPoint | null
  setSnapPoint: Dispatch<SetStateAction<QuickActionsSnapPoint | null>>
  isDock: boolean
  isFull: boolean
}

const CampaignQuickActionsSnapContext = createContext<CampaignQuickActionsSnapContextValue | null>(
  null,
)

export const CampaignQuickActionsSnapProvider = ({ children }: { children: ReactNode }) => {
  // B112 — load = dock; pathname collapse lives in the drawer (needs `clear`).
  const [snapPoint, setSnapPoint] = useState<QuickActionsSnapPoint | null>(QUICK_ACTIONS_SNAP_DOCK)

  const value = useMemo(
    (): CampaignQuickActionsSnapContextValue => ({
      snapPoint,
      setSnapPoint,
      isDock: quickActionsSnapIsDock(snapPoint),
      isFull: quickActionsSnapIsFull(snapPoint),
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
