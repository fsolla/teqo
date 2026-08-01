'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'

const HomeSearchExcludeContext = createContext<CampaignQuickActionContext | null>(null)

export const HomeSearchExcludeProvider = ({
  value,
  children,
}: {
  value: CampaignQuickActionContext
  children: ReactNode
}) => (
  <HomeSearchExcludeContext.Provider value={value}>{children}</HomeSearchExcludeContext.Provider>
)

export const useHomeSearchExcludeContext = (): CampaignQuickActionContext | null =>
  useContext(HomeSearchExcludeContext)
