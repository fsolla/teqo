'use client'

import { ChevronDownIcon, FilterIcon, XIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The collapsible filter panel of the list filter shells (P3-F — extracted
 * from ActivityFilters/SupporterFilters, ~30 near-verbatim lines each):
 * always-open on desktop, a disclosure card with 44 px targets on mobile,
 * and the "Limpar filtros" footer when any filter is active.
 */
export const CampaignCollapsibleFilterPanel = ({
  panelId,
  hasFilters,
  onClear,
  children,
}: {
  panelId: string
  hasFilters: boolean
  onClear: () => void
  children: ReactNode
}) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  return (
    <div className="rounded-[6px] border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full justify-start rounded-[6px] px-3 lg:hidden"
        aria-expanded={mobileFiltersOpen}
        aria-controls={panelId}
        onClick={() => setMobileFiltersOpen((open) => !open)}
      >
        <FilterIcon data-icon="inline-start" aria-hidden="true" />
        <span>Filtros</span>
        <ChevronDownIcon data-icon="inline-end" className="ml-auto" aria-hidden="true" />
      </Button>
      <div
        id={panelId}
        className={cn(
          mobileFiltersOpen ? 'block' : 'hidden',
          'border-t p-4 lg:block lg:border-t-0',
        )}
      >
        {children}
        {hasFilters ? (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-[6px]"
              onClick={onClear}
            >
              <XIcon data-icon="inline-start" aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
