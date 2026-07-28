'use client'

import { useSyncExternalStore } from 'react'

import {
  listMunicipalitySavedFilters,
  subscribeMunicipalitySavedFilters,
  type MunicipalitySavedFilter,
} from '@/utilities/municipalitySavedFilters'

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
