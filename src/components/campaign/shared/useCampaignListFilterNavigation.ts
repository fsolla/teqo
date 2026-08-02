'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'

/**
 * Navigation scaffold for list filter shells (B127/B128 omnibox). The hook never
 * decides what is canonical — `toHref` comes from the domain's own URL module
 * (`buildXListHref`, which already canonicalizes).
 */
export const useCampaignListFilterNavigation = <State extends object>({
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

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const navigate = (next: State) => {
    const nextHref = toHref(next)
    if (nextHref === toHref(stateRef.current)) return
    startTransition(() => {
      router.replace(nextHref, { scroll: false })
    })
  }

  return {
    isPending,
    navigate,
  }
}
