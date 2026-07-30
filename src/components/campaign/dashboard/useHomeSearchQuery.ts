'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  HOME_SEARCH_DEBOUNCE_MS,
  homeSearchQueryIsActive,
  homeSearchUiFocused,
  normalizeHomeSearchRaw,
  type HomeSearchQuery,
} from '@/lib/campaignHomeSearchContract'

export type HomeSearchController = {
  query: HomeSearchQuery
  setRaw: (next: string) => void
  clear: () => void
  isDebouncing: boolean
  inputFocused: boolean
  setInputFocused: (next: boolean) => void
  uiFocused: boolean
}

export const useHomeSearchQuery = (): HomeSearchController => {
  const [raw, setRaw] = useState('')
  const [debounced, setDebounced] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

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

  const uiFocused = homeSearchUiFocused({
    inputFocused,
    isActive: query.isActive,
  })

  const clear = useCallback(() => {
    setRaw('')
    setDebounced('')
    setInputFocused(false)
  }, [])

  return useMemo(
    () => ({
      query,
      setRaw,
      clear,
      isDebouncing,
      inputFocused,
      setInputFocused,
      uiFocused,
    }),
    [query, clear, isDebouncing, inputFocused, uiFocused],
  )
}
