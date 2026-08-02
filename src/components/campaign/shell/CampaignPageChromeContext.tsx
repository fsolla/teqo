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

import type { CampaignPageChrome } from '@/lib/campaignPageChrome'
import type { CampaignUser } from '@/payload-types'

type CampaignPageChromeContextValue = {
  role: CampaignUser['role']
  override: CampaignPageChrome | null
  setOverride: Dispatch<SetStateAction<CampaignPageChrome | null>>
}

const CampaignPageChromeContext = createContext<CampaignPageChromeContextValue | null>(null)

export const CampaignPageChromeProvider = ({
  role,
  children,
}: {
  role: CampaignUser['role']
  children: ReactNode
}) => {
  const [override, setOverride] = useState<CampaignPageChrome | null>(null)
  const value = useMemo(() => ({ role, override, setOverride }), [role, override])

  return (
    <CampaignPageChromeContext.Provider value={value}>
      {children}
    </CampaignPageChromeContext.Provider>
  )
}

const useCampaignPageChromeContext = (): CampaignPageChromeContextValue => {
  const value = useContext(CampaignPageChromeContext)
  if (!value) {
    throw new Error('CampaignPageChromeProvider is required')
  }
  return value
}

export const useCampaignPageChromeRole = (): CampaignUser['role'] =>
  useCampaignPageChromeContext().role

export const useCampaignPageChromeOverride = (): CampaignPageChrome | null =>
  useCampaignPageChromeContext().override

export const SetCampaignPageChrome = ({ chrome }: { chrome: CampaignPageChrome }): null => {
  const { setOverride } = useCampaignPageChromeContext()

  useLayoutEffect(() => {
    setOverride(chrome)
  }, [setOverride, chrome])

  useLayoutEffect(
    () => () => {
      setOverride(null)
    },
    [setOverride],
  )

  return null
}
