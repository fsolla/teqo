'use client'

import { useCallback, useMemo } from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import { useHomeSearchFocusHistory } from '@/components/campaign/dashboard/useHomeSearchFocusHistory'
import {
  useSetCampaignHomeSearchChrome,
  type CampaignHomeSearchChromeState,
} from '@/components/campaign/shell/CampaignHomeSearchChromeContext'

/** Publishes Início search chrome to the layout top bar (B106). */
export const CampaignHomeSearchChromePublisher = () => {
  const { clear, uiFocused } = useHomeSearch()

  const collapse = useCallback(() => {
    clear()
  }, [clear])

  const chrome = useMemo((): CampaignHomeSearchChromeState | null => {
    if (!uiFocused) {
      return null
    }
    return { focused: true, collapse }
  }, [collapse, uiFocused])

  useSetCampaignHomeSearchChrome(chrome)
  useHomeSearchFocusHistory({ focused: uiFocused, onCollapse: collapse })

  return null
}
