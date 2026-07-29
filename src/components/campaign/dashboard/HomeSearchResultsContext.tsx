'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useHomeSearch } from '@/components/campaign/dashboard/HomeSearchContext'
import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_GENERIC_ERROR_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { postCampaignJson } from '@/lib/campaignJsonRequest'

const HOME_SEARCH_ROUTE = '/campanha/home-search'

type HomeSearchResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: HomeSearchSuccessResponse }
  | { status: 'error'; message: string }

export type HomeSearchResultsContextValue = {
  results: HomeSearchResultsState
  isFetching: boolean
}

const HomeSearchResultsContext = createContext<HomeSearchResultsContextValue | null>(null)

export const HomeSearchResultsProvider = ({
  value,
  children,
}: {
  value: HomeSearchResultsContextValue
  children: ReactNode
}) => (
  <HomeSearchResultsContext.Provider value={value}>{children}</HomeSearchResultsContext.Provider>
)

export const useHomeSearchResults = (): HomeSearchResultsContextValue => {
  const ctx = useContext(HomeSearchResultsContext)
  if (!ctx) {
    throw new Error('useHomeSearchResults must be used within HomeSearchResultsProvider')
  }
  return ctx
}

type HomeSearchErrorResponse = { status: 'error'; message: string }

export const useHomeSearchResultsState = (): HomeSearchResultsContextValue => {
  const { query, isDebouncing } = useHomeSearch()
  const [results, setResults] = useState<HomeSearchResultsState>({ status: 'idle' })
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!query.isActive) {
      requestSeq.current += 1
      setResults({ status: 'idle' })
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()
    setResults({ status: 'loading' })

    void (async () => {
      const { ok, payload } = await postCampaignJson<
        HomeSearchSuccessResponse | HomeSearchErrorResponse
      >(HOME_SEARCH_ROUTE, { query: query.debounced }, controller.signal)

      if (seq !== requestSeq.current) return

      if (!ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'message' in payload &&
          payload.status === 'error'
            ? payload.message
            : HOME_SEARCH_GENERIC_ERROR_MESSAGE
        setResults({ status: 'error', message })
        return
      }

      if (payload && typeof payload === 'object' && payload.status === 'success') {
        setResults({ status: 'success', data: payload })
        return
      }

      setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
    })().catch((error: unknown) => {
      if (seq !== requestSeq.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
    })

    return () => {
      controller.abort()
    }
  }, [query.debounced, query.isActive])

  const isFetching = isDebouncing || results.status === 'loading'

  return useMemo(
    () => ({
      results,
      isFetching,
    }),
    [results, isFetching],
  )
}
