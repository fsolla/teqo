import type { ReactNode } from 'react'

export const CampaignHomeLayout = ({
  actions,
  searchSlot,
}: {
  actions: ReactNode
  searchSlot?: ReactNode
}) => (
  <div className="flex min-h-full w-full flex-col md:min-h-0">
    <div aria-hidden className="min-h-0 flex-1 md:hidden" />
    <div data-slot="home-actions" className="order-1 min-w-0 md:order-2">
      {actions}
    </div>
    {searchSlot ? (
      <div data-slot="home-search" className="order-3 mt-4 min-w-0 md:order-1 md:mt-0 md:mb-6">
        {searchSlot}
      </div>
    ) : null}
  </div>
)
