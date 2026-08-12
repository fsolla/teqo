'use client'

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

type CampaignBridgedQuickActionKey =
  | 'openCalendarFeed'
  | 'openGoogleCalendarSync'
  | 'openActivityCreate'
  | 'openActivityEdit'

/**
 * Registers a dialog-style quick action into the shared context while the
 * owning surface is mounted (precedent C94/C114, reused by C123 hosts). The
 * same key is unregistered on unmount so the FAB never fires a stale closure.
 */
export const useBridgedQuickAction = (key: CampaignBridgedQuickActionKey, open: () => void) => {
  const { setContext } = useCampaignQuickActionContext()
  useEffect(() => {
    setContext((current) => ({ ...current, [key]: open }))
    return () => {
      setContext((current) => ({ ...current, [key]: undefined }))
    }
  }, [setContext, key, open])
}
