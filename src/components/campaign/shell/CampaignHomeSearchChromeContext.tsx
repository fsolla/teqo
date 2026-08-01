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

export type CampaignHomeSearchChromeState = {
  focused: boolean
  collapse: () => void
}

type CampaignHomeSearchChromeContextValue = {
  chrome: CampaignHomeSearchChromeState | null
  setChrome: Dispatch<SetStateAction<CampaignHomeSearchChromeState | null>>
}

const CampaignHomeSearchChromeContext = createContext<CampaignHomeSearchChromeContextValue | null>(
  null,
)

export const CampaignHomeSearchChromeProvider = ({ children }: { children: ReactNode }) => {
  const [chrome, setChrome] = useState<CampaignHomeSearchChromeState | null>(null)
  const value = useMemo(() => ({ chrome, setChrome }), [chrome])

  return (
    <CampaignHomeSearchChromeContext.Provider value={value}>
      {children}
    </CampaignHomeSearchChromeContext.Provider>
  )
}

export const useCampaignHomeSearchChrome = (): CampaignHomeSearchChromeState | null => {
  const value = useContext(CampaignHomeSearchChromeContext)
  return value?.chrome ?? null
}

const useCampaignHomeSearchChromeContext = (): CampaignHomeSearchChromeContextValue => {
  const value = useContext(CampaignHomeSearchChromeContext)
  if (!value) {
    throw new Error('CampaignHomeSearchChromeProvider is required')
  }
  return value
}

export const useSetCampaignHomeSearchChrome = (
  state: CampaignHomeSearchChromeState | null,
): void => {
  const { setChrome } = useCampaignHomeSearchChromeContext()

  useLayoutEffect(() => {
    setChrome(state)
  }, [setChrome, state])

  useLayoutEffect(
    () => () => {
      setChrome(null)
    },
    [setChrome],
  )
}
