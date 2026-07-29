import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const CampaignHomeLayout = ({
  actions,
  searchSlot,
  focused = false,
}: {
  actions: ReactNode
  searchSlot?: ReactNode
  /** When true (trimmed debounced query length ≥ min), hide thumb-zone spacer and action strip. */
  focused?: boolean
}) => (
  <div className="flex min-h-full w-full flex-col md:min-h-0">
    {focused ? null : (
      <div aria-hidden className="min-h-0 flex-1 md:hidden" data-slot="home-thumb-spacer" />
    )}
    <div data-slot="home-actions" className={cn('order-1 min-w-0 md:order-2', focused && 'hidden')}>
      {actions}
    </div>
    {searchSlot ? (
      <div
        data-slot="home-search"
        className={cn('order-3 min-w-0 md:order-1', focused ? 'mt-0' : 'mt-4 md:mt-0 md:mb-6')}
      >
        {searchSlot}
      </div>
    ) : null}
  </div>
)
