'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  HOME_SEARCH_DEBOUNCE_MS,
  homeSearchQueryIsActive,
  normalizeHomeSearchRaw,
  type HomeSearchQuery,
} from '@/lib/campaignHomeSearchContract'

export type HomeSearchController = {
  query: HomeSearchQuery
  setRaw: (next: string) => void
  clear: () => void
  isDebouncing: boolean
}

export const useHomeSearchQuery = (): HomeSearchController => {
  const [raw, setRaw] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    if (raw === debounced) {
      return
    }
    const handle = window.setTimeout(() => {
      setDebounced(raw)
    }, HOME_SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(handle)
    }
  }, [raw, debounced])

  const trimmedDebounced = normalizeHomeSearchRaw(debounced)
  const isDebouncing = raw !== debounced

  const query = useMemo(
    (): HomeSearchQuery => ({
      raw,
      debounced: trimmedDebounced,
      isActive: homeSearchQueryIsActive(trimmedDebounced),
    }),
    [raw, trimmedDebounced],
  )

  const clear = useCallback(() => {
    setRaw('')
    setDebounced('')
  }, [])

  return useMemo(
    () => ({
      query,
      setRaw,
      clear,
      isDebouncing,
    }),
    [query, clear, isDebouncing],
  )
}
