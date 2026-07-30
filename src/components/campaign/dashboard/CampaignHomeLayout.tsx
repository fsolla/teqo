import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const CampaignHomeLayout = ({
  actions,
  searchSlot,
  summarySlot,
  focused = false,
}: {
  actions: ReactNode
  searchSlot?: ReactNode
  summarySlot?: ReactNode
  /** When true (input focused or query active), hide thumb-zone spacer and action strip. */
  focused?: boolean
}) => (
  <div className="flex h-full min-h-0 w-full flex-col">
    {summarySlot ? (
      <div className={cn('order-0 min-w-0', focused && 'hidden')} data-slot="home-summary">
        {summarySlot}
      </div>
    ) : null}
    <div
      aria-hidden
      className={cn('min-h-0 flex-1 md:hidden', focused && 'hidden')}
      data-slot="home-thumb-spacer"
    />
    <div data-slot="home-dock" className="flex min-w-0 flex-col">
      <div
        data-slot="home-actions"
        className={cn('order-1 min-w-0 md:order-2', focused && 'hidden')}
      >
        {actions}
      </div>
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
