'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type MouseEvent } from 'react'

import { useCampaignListPending } from '@/components/campaign/CampaignListPending'
import { Button } from '@/components/ui/button'

export type CampaignFilterChip = {
  href: string
  label: string
  active: boolean
}

/**
 * Status/kind chips that navigate via URL. Optimistic on the chip (the tapped
 * one activates at once), honest pending on the results (shared boundary
 * transition dims them) — "Feel the action".
 */
export const CampaignFilterChips = ({
  ariaLabel,
  chips,
}: {
  ariaLabel: string
  chips: CampaignFilterChip[]
}) => {
  const router = useRouter()
  const shared = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  const isPending = shared?.isPending ?? isLocalPending
  const startTransition = shared?.startTransition ?? startLocalTransition
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null)

  const activeHref =
    isPending && optimisticHref !== null
      ? optimisticHref
      : (chips.find((chip) => chip.active)?.href ?? null)

  const interceptNavigation = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    setOptimisticHref(href)
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <nav aria-label={ariaLabel} aria-busy={isPending} className="flex flex-wrap gap-2">
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      {chips.map((chip) => (
        <Button
          key={chip.href}
          asChild
          variant={chip.href === activeHref ? 'default' : 'outline'}
          className="min-h-11"
        >
          <Link href={chip.href} onClick={(event) => interceptNavigation(event, chip.href)}>
            {chip.label}
          </Link>
        </Button>
      ))}
    </nav>
  )
}
