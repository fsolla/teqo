import { useEffect, useRef, useState } from 'react'

export const ASYNC_SEARCH_DEBOUNCE_MS = 250

export type UseAsyncSearchOptionsResult<T> = {
  options: T[]
  loading: boolean
  failed: boolean
}

type UseAsyncSearchOptionsArgs<T> = {
  open: boolean
  query: string
  search: (query: string) => Promise<T[]>
  isQueryReady?: (query: string) => boolean
}

/**
 * E1 — the shared async-search-with-debounce effect (requestId guard against
 * out-of-order responses, loading/failed states, per-consumer query gate).
 * The server action is injected as a prop by the consumer, keeping this module
 * client-safe; each consumer keeps its own filtering/grouping/pinned options.
 */
export function useAsyncSearchOptions<T extends { id: number }>({
  open,
  query,
  search,
  isQueryReady = () => true,
}: UseAsyncSearchOptionsArgs<T>): UseAsyncSearchOptionsResult<T> {
  const [options, setOptions] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)
  const searchRef = useRef(search)
  const isQueryReadyRef = useRef(isQueryReady)

  searchRef.current = search
  isQueryReadyRef.current = isQueryReady

  useEffect(() => {
    if (!open) return
    if (!isQueryReadyRef.current(query)) {
      setOptions([])
      setLoading(false)
      setFailed(false)
      return
    }

    const currentRequestId = ++requestId.current
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setFailed(false)
      void searchRef
        .current(query.trim())
        .then((nextOptions) => {
          if (requestId.current !== currentRequestId) return
          setOptions(nextOptions)
        })
        .catch(() => {
          if (requestId.current !== currentRequestId) return
          setFailed(true)
        })
        .finally(() => {
          if (requestId.current === currentRequestId) setLoading(false)
        })
    }, ASYNC_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [open, query])

  return { options, loading, failed }
}
