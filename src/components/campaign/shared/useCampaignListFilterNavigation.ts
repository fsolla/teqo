'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { normalizedText } from '@/utilities/campaignListUrl'

/**
 * Long for search-as-you-type on purpose: every commit is an RSC round trip
 * over a mobile connection, and the field team types município names slowly.
 */
export const SEARCH_DEBOUNCE_MS = 1000

/**
 * Navigation scaffold shared by the list filter shells (municípios,
 * territórios, dobradinhas): debounced search, no-op deduplication and the
 * pending transition the results region dims with.
 *
 * The hook never decides what is canonical — `toHref` comes from the domain's
 * own URL module (`buildXListHref`, which already canonicalizes), so the three
 * URL contracts stay independent instead of collapsing into one DSL.
 */
export const useCampaignListFilterNavigation = <State extends { q?: string }>({
  state,
  toHref,
}: {
  /** Canonical state parsed from the URL on the server. */
  state: State
  /** Domain serializer; must canonicalize and pin the page reset it wants. */
  toHref: (next: State) => string
}) => {
  const router = useRouter()
  const { isPending, startTransition } = useCampaignListTransition()
  const [search, setSearch] = useState(state.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /**
   * The controls that navigate from *outside* this shell — sortable heads,
   * pagination, the empty state's "Limpar" — change `state` without touching
   * the pending timer. Reading the committed state through a ref keeps a timer
   * scheduled before such a navigation from reverting it a second later.
   */
  const stateRef = useRef(state)
  stateRef.current = state

  const clearDebounce = () => {
    if (!debounceRef.current) return
    clearTimeout(debounceRef.current)
    debounceRef.current = null
  }

  useEffect(() => clearDebounce, [])

  /**
   * Cancels any pending search, then navigates — unless `next` serializes to
   * what is already committed. Both sides pin the same page, so the guard asks
   * "do the filters and sort change?", not "is this the current URL?": a
   * re-submitted identical search on page 3 leaves the user on page 3.
   *
   * Cancelling before the guard is why `clearDebounce` is not exposed: the
   * three "Limpar" buttons need nothing beyond `setSearch('') + navigateTo`.
   */
  const navigateTo = (next: State) => {
    clearDebounce()
    const nextHref = toHref(next)
    if (nextHref === toHref(stateRef.current)) return
    startTransition(() => {
      router.replace(nextHref, { scroll: false })
    })
  }

  /**
   * Same as `navigateTo`, carrying the search the user has typed but not yet
   * committed — otherwise touching a filter mid-typing would drop it while the
   * input keeps showing the text.
   *
   * Not interchangeable with `navigateTo`: "Limpar" calls `setSearch('')` and
   * that setter has not flushed yet, so going through here would re-commit the
   * search the user just cleared.
   */
  const navigateWithSearch = (next: State) => {
    navigateTo({ ...next, q: normalizedText(search) })
  }

  /**
   * Typing back to the committed value cancels a pending navigation rather
   * than merely skipping a new one — the guard lives in `navigateTo`, so the
   * timer is free to resolve to a no-op.
   */
  const scheduleSearch = (value: string) => {
    clearDebounce()
    debounceRef.current = setTimeout(() => {
      navigateTo({ ...stateRef.current, q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  return {
    search,
    setSearch,
    /**
     * What the active-filters summary should describe: the text being typed,
     * falling back to the committed `q` while the box is empty (the results on
     * screen are still the committed query's).
     */
    draftQ: normalizedText(search) || state.q,
    isPending,
    navigateTo,
    navigateWithSearch,
    scheduleSearch,
  }
}
