import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

const homeChromeRetractionClass = (retracted: boolean) =>
  cn(
    'grid min-h-0 transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none',
    retracted
      ? 'grid-rows-[0fr] opacity-0 pointer-events-none motion-reduce:opacity-0'
      : 'grid-rows-[1fr] opacity-100 motion-reduce:opacity-100',
  )

const HomeChromeRetractionShell = ({
  retracted,
  slot,
  className,
  children,
  allowHorizontalBleed = false,
}: {
  retracted: boolean
  slot?: string
  className?: string
  children: ReactNode
  /** B111 — keep Y clip for grid-rows retraction without clipping -mx bleed on X. */
  allowHorizontalBleed?: boolean
}) => (
  <div
    data-slot={slot}
    data-retracted={retracted || undefined}
    className={cn(homeChromeRetractionClass(retracted), className)}
    aria-hidden={retracted || undefined}
  >
    <div
      className={cn('min-h-0', allowHorizontalBleed ? 'overflow-y-hidden' : 'overflow-hidden')}
      data-allow-horizontal-bleed={allowHorizontalBleed || undefined}
    >
      {children}
    </div>
  </div>
)

export const CampaignHomeLayout = ({
  actions,
  searchSlot,
  summarySlot,
  focused = false,
}: {
  actions: ReactNode
  searchSlot?: ReactNode
  summarySlot?: ReactNode
  /** When true (input focused or query active), retract thumb-zone spacer and action strip. */
  focused?: boolean
}) => (
  <div className="flex h-full min-h-0 w-full flex-col">
    <HomeChromeRetractionShell
      retracted={focused}
      slot="home-chrome"
      className={!focused ? 'min-h-0 flex-1 md:flex-none' : undefined}
    >
      <div className="flex h-full min-h-0 flex-col">
        {summarySlot ? (
          <div className="min-w-0" data-slot="home-summary">
            {summarySlot}
          </div>
        ) : null}
        <div aria-hidden className="min-h-0 flex-1 md:hidden" data-slot="home-thumb-spacer" />
      </div>
    </HomeChromeRetractionShell>
    <div data-slot="home-dock" className="flex min-w-0 flex-col">
      <HomeChromeRetractionShell
        retracted={focused}
        slot="home-actions-chrome"
        className="order-1 md:order-2"
      >
        <div
          data-slot="home-actions"
          className="min-w-0 md:mx-0 md:w-auto"
        >
          {actions}
        </div>
      </HomeChromeRetractionShell>
      {searchSlot ? (
        <div
          data-slot="home-search"
          className={cn('order-2 min-w-0 md:order-1', focused ? 'mt-0' : 'mt-4 md:mt-0 md:mb-6')}
        >
          {searchSlot}
        </div>
      ) : null}
    </div>
  </div>
)
