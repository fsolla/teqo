'use client'

import {
  createContext,
  useCallback,
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

/**
 * Header action nodes registered by pages, rendered in the app header in
 * insertion order (C94/C95 shared slot — e.g. the agenda-contextual "Link de
 * import").
 */
export type CampaignHeaderActionsMap = Record<string, ReactNode>

type CampaignPageChromeContextValue = {
  role: CampaignUser['role']
  override: CampaignPageChrome | null
  setOverride: Dispatch<SetStateAction<CampaignPageChrome | null>>
  headerActions: CampaignHeaderActionsMap
  setHeaderAction: (key: string, node: ReactNode | null) => void
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
  const [headerActions, setHeaderActions] = useState<CampaignHeaderActionsMap>({})

  const setHeaderAction = useCallback((key: string, node: ReactNode | null) => {
    setHeaderActions((current) => {
      const next = { ...current }
      if (node === null) {
        delete next[key]
      } else {
        next[key] = node
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ role, override, setOverride, headerActions, setHeaderAction }),
    [role, override, headerActions, setHeaderAction],
  )

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

export const useCampaignHeaderActions = (): CampaignHeaderActionsMap =>
  useCampaignPageChromeContext().headerActions

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

/**
 * Registers a page-owned control into the app header's right cluster
 * (agenda-contextual by nature — only pages render it). Not rendered in place.
 */
export const SetCampaignHeaderAction = ({
  id,
  children,
}: {
  id: string
  children: ReactNode
}): null => {
  const setHeaderAction = useCampaignPageChromeContext().setHeaderAction

  useLayoutEffect(() => {
    setHeaderAction(id, children)
    return () => setHeaderAction(id, null)
  }, [setHeaderAction, id, children])

  return null
}
