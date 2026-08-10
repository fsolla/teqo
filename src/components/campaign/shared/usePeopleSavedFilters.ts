'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useSyncExternalStore } from 'react'

import { isSameListHref } from '@/lib/listQueryMatch'
import {
  listPeopleSavedFilters,
  subscribePeopleSavedFilters,
  type PeopleSavedFilter,
} from '@/utilities/people/peopleSavedFilters'

/** A page is a position inside a recorte, not part of it (B18 pattern). */
const PEOPLE_SAVED_FILTER_IGNORED_PARAMS = ['page'] as const

/**
 * Stable reference for the render that has no `localStorage` to read. Returning
 * a fresh `[]` here is the classic `useSyncExternalStore` render loop.
 */
const NO_SAVED_FILTERS: readonly PeopleSavedFilter[] = []

/**
 * The filter bar writes this store and the sidebar reads it, from trees that
 * never meet — so both subscribe rather than lift state, and one write repaints
 * both (same contract as `useMunicipalitySavedFilters`).
 */
export const usePeopleSavedFilters = (): readonly PeopleSavedFilter[] =>
  useSyncExternalStore(subscribePeopleSavedFilters, listPeopleSavedFilters, () => NO_SAVED_FILTERS)

/** The saved filter whose href matches the current list URL, if any. */
export const useActivePeopleSavedFilter = (): PeopleSavedFilter | undefined => {
  const savedFilters = usePeopleSavedFilters()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useMemo(() => {
    const query = searchParams.toString()
    const currentHref = query ? `${pathname}?${query}` : pathname
    return savedFilters.find((entry) =>
      isSameListHref(currentHref, entry.href, PEOPLE_SAVED_FILTER_IGNORED_PARAMS),
    )
  }, [pathname, searchParams, savedFilters])
}
