'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
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
}: {
  ariaLabel: string
  placeholder: string
  initialQuery: string
  /** List route; the query lands as `?q=` (serializable — no function props across the RSC boundary). */
  basePath: string
}) => {
  const router = useRouter()
  const { isPending, startTransition } = useCampaignListTransition()
  const [query, setQuery] = useState(initialQuery)

  const hrefForQuery = (value: string) =>
    value ? `${basePath}?q=${encodeURIComponent(value)}` : basePath

  return (
    <form
      role="search"
      className="flex gap-2 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending || undefined}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        startTransition(() => {
          router.replace(hrefForQuery(query), { scroll: false })
        })
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
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
