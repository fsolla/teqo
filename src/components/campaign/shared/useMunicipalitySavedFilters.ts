'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useMemo, useSyncExternalStore } from 'react'

import { isSameListHref } from '@/lib/listQueryMatch'
import {
  listMunicipalitySavedFilters,
  subscribeMunicipalitySavedFilters,
  type MunicipalitySavedFilter,
} from '@/utilities/municipality/municipalitySavedFilters'

/** A page is a position inside a recorte, not part of it (B18). */
const MUNICIPALITY_SAVED_FILTER_IGNORED_PARAMS = ['page'] as const

/**
 * Stable reference for the render that has no `localStorage` to read. Returning
 * a fresh `[]` here is the classic `useSyncExternalStore` render loop.
 */
const NO_SAVED_FILTERS: readonly MunicipalitySavedFilter[] = []

/**
 * The filter bar writes this store and the sidebar reads it, from trees that
 * never meet — so both subscribe rather than lift state, and one write repaints
 * both. Shared because the snapshot/subscribe pairing is exactly the thing that
 * must not be written twice.
 */
export const useMunicipalitySavedFilters = (): readonly MunicipalitySavedFilter[] =>
  useSyncExternalStore(
    subscribeMunicipalitySavedFilters,
    listMunicipalitySavedFilters,
    () => NO_SAVED_FILTERS,
  )

/** The saved filter whose href matches the current list URL, if any (B18/B133). */
export const useActiveMunicipalitySavedFilter = (): MunicipalitySavedFilter | undefined => {
  const savedFilters = useMunicipalitySavedFilters()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useMemo(() => {
    const query = searchParams.toString()
    const currentHref = query ? `${pathname}?${query}` : pathname
    return savedFilters.find((entry) =>
      isSameListHref(currentHref, entry.href, MUNICIPALITY_SAVED_FILTER_IGNORED_PARAMS),
    )
  }, [pathname, searchParams, savedFilters])
}
