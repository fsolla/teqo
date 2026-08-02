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
 * URL contracts stay independent instead of collapsing into one DSL. Raw
 * keystrokes are handed to `toHref` untrimmed for the same reason: trimming is
 * the serializer's job, and doing it here too would be a second policy.
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [search, setSearch] = useState(state.q ?? '')

  /**
   * Follow the URL when the committed query changes under us — back/forward and
   * the empty state's "Limpar busca e filtros" navigate from outside this shell.
   * Without this the box would keep showing a query the URL no longer has, and
   * the next filter touch would put it back (`navigateWithSearch` carries the
   * box). A pending debounce wins: that text is the user's, not the URL's.
   */
  const [committedQ, setCommittedQ] = useState(state.q)
  if (state.q !== committedQ) {
    setCommittedQ(state.q)
    if (!debounceRef.current) setSearch(state.q ?? '')
  }

  /**
   * The controls that navigate from *outside* this shell — sortable heads,
   * pagination — change `state` without touching the pending timer. Reading the
   * committed state through a ref keeps a timer scheduled before such a
   * navigation from reverting it a second later. Written in an effect, not
   * during render: an interrupted transition render is abandoned before commit,
   * and the timer must not resolve against state that never landed.
   */
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

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
   * Navigates carrying the search the user has typed but not yet committed —
   * otherwise touching a filter mid-typing would drop it while the input keeps
   * showing the text.
   */
  const navigateWithSearch = (next: State) => {
    navigateTo({ ...next, q: search })
  }

  /**
   * The "Limpar" buttons: empties the box and drops `q` in the same gesture.
   * Exists so no caller has to know that `navigateWithSearch` would re-commit
   * the search being cleared, because `setSearch('')` has not flushed yet.
   */
  const clearSearchAndNavigate = (next: State) => {
    setSearch('')
    navigateTo(next)
  }

  /**
   * The search input's only handler: mirrors the keystroke and (re)arms the
   * debounce in one call, so no caller can wire up half of it.
   *
   * Typing back to the committed value still arms a timer — it cancels the
   * pending navigation rather than merely skipping a new one, because the guard
   * lives in `navigateTo` and the timer is free to resolve to a no-op.
   */
  const onSearchChange = (value: string) => {
    setSearch(value)
    clearDebounce()
    debounceRef.current = setTimeout(() => {
      navigateTo({ ...stateRef.current, q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  return {
    search,
    /**
     * Raw box write with no debounce/navigation — used after a typeahead pick
     * so the URL can keep the committed `q` while the input is ready for the
     * next filter keyword.
     */
    setSearch,
    onSearchChange,
    /**
     * What the active-filters summary should describe. The draft wins while the
     * box is non-empty; an emptied box falls back to the committed `q` so the
     * summary does not flicker off during the debounce, before the results it
     * describes have actually changed.
     */
    draftQ: normalizedText(search) || state.q,
    isPending,
    navigateWithSearch,
    clearSearchAndNavigate,
  }
}
