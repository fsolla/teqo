'use client'

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import {
  emptyCampaignQuickActionContext,
  type CampaignQuickActionContext,
} from '@/lib/campaignQuickActionContext'

type CampaignQuickActionContextValue = {
  context: CampaignQuickActionContext
  setContext: Dispatch<SetStateAction<CampaignQuickActionContext>>
}

const QuickActionContext = createContext<CampaignQuickActionContextValue | null>(null)

export const CampaignQuickActionContextProvider = ({ children }: { children: ReactNode }) => {
  const [context, setContext] = useState<CampaignQuickActionContext>(
    emptyCampaignQuickActionContext,
  )
  const value = useMemo(() => ({ context, setContext }), [context])

  return <QuickActionContext.Provider value={value}>{children}</QuickActionContext.Provider>
}

export const useCampaignQuickActionContext = (): CampaignQuickActionContextValue => {
  const value = useContext(QuickActionContext)
  if (!value) {
    throw new Error('CampaignQuickActionContextProvider is required')
  }
  return value
}

/** B80+ — set page context for the current route (cleared on unmount). */
export const useSetCampaignQuickActionContext = (next: CampaignQuickActionContext): void => {
  const { setContext } = useCampaignQuickActionContext()

  useLayoutEffect(() => {
    setContext(next)
  }, [next, setContext])

  useLayoutEffect(
    () => () => {
      setContext(emptyCampaignQuickActionContext())
    },
    [setContext],
  )
}
