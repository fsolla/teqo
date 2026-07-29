'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { SEARCH_DEBOUNCE_MS } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'

/**
 * Name-search form for simple list pages (lideranças, organizações,
 * dobradinhas): keeps the input value locally (optimistic) and navigates in a
 * transition so the results region dims instead of a dead full-page wait.
 */
export const CampaignSearchForm = ({
  ariaLabel,
  placeholder,
  initialQuery,
  basePath,
  filterParams = '',
}: {
  ariaLabel: string
  placeholder: string
  initialQuery: string
  /** List route; the query lands as `?q=` (serializable — no function props across the RSC boundary). */
  basePath: string
  /**
   * The ACTIVE filters' canonical serialization (minus `q`/`page`), produced
   * server-side by the domain's own serializer (P3-F): submitting the search
   * must not silently drop the other filters, which the hand-rolled `?q=`
   * used to do.
   */
  filterParams?: string
}) => {
  const router = useRouter()
  const { isPending, startTransition } = useCampaignListTransition()
  const [query, setQuery] = useState(initialQuery)

  const hrefForQuery = (value: string) => {
    const params = new URLSearchParams(filterParams)
    if (value) params.set('q', value)
    const queryString = params.toString()
    return queryString ? `${basePath}?${queryString}` : basePath
  }

  const navigateIfChanged = (value: string) => {
    // No-op guard (same policy as `useCampaignListFilterNavigation`): the URL
    // already carries exactly this query — don't pay an RSC round-trip.
    if (value === initialQuery) return
    startTransition(() => {
      router.replace(hrefForQuery(value), { scroll: false })
    })
  }

  /**
   * Search-as-you-type (P3-F unified idiom — this form used to navigate only
   * on explicit submit): the debounce commits what the user settled on; the
   * Buscar button remains as the immediate path for keyboard users in a hurry.
   */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )
  const onQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      navigateIfChanged(value)
    }, SEARCH_DEBOUNCE_MS)
  }

  return (
    <form
      role="search"
      className="flex gap-2 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending || undefined}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        navigateIfChanged(query)
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-h-11 w-full max-w-md rounded-[6px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30"
      />
      <Button type="submit" variant="secondary" className="min-h-11" disabled={isPending}>
        Buscar
      </Button>
    </form>
  )
}
