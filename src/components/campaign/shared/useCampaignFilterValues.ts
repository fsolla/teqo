'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'

/**
 * The filter-values state machine of the list filter shells (P3-F — extracted
 * from ActivityFilters/SupporterFilters, where it was spelled twice WITHOUT
 * the no-op guard): local mirror for instant feedback, committed-href
 * deduplication so re-selecting the already-active value never pays an RSC
 * round-trip, and the pending transition the results region dims with.
 *
 * `toHref` comes from the domain's own serializer — the hook never decides
 * what is canonical.
 */
export const useCampaignFilterValues = <Values>({
  committedValues,
  toHref,
}: {
  /** Values parsed from the URL on the server — fresh on every render. */
  committedValues: Values
  /** Domain serializer; must canonicalize and pin the page reset it wants. */
  toHref: (values: Values) => string
}) => {
  const router = useRouter()
  const { isPending, startTransition } = useCampaignListTransition()
  const valuesRef = useRef(committedValues)
  const [values, setValues] = useState(committedValues)

  // The committed URL's href, written in an effect: an interrupted transition
  // render is abandoned before commit, and a later navigation must not be
  // deduplicated against state that never landed (same lesson as
  // `useCampaignListFilterNavigation`'s stateRef).
  const committedHrefRef = useRef(toHref(committedValues))
  useEffect(() => {
    committedHrefRef.current = toHref(committedValues)
  })

  const replaceValues = (next: Values) => {
    valuesRef.current = next
    setValues(next)
    const href = toHref(next)
    if (href === committedHrefRef.current) return
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  /** Functional update against the LATEST values, not the render that scheduled it. */
  const updateValues = (updater: (current: Values) => Values) => {
    replaceValues(updater(valuesRef.current))
  }

  /** Mirror a keystroke locally WITHOUT navigating (the debounce commits later). */
  const setLocalValues = (updater: (current: Values) => Values) => {
    const next = updater(valuesRef.current)
    valuesRef.current = next
    setValues(next)
  }

  return { values, isPending, replaceValues, updateValues, setLocalValues }
}
