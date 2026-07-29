'use client'

import {
  CampaignHomeActionButton,
  type CampaignHomeActionButtonProps,
} from '@/components/campaign/dashboard/CampaignHomeActionButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const CampaignHomeActionStrip = ({
  actions,
  ariaLabel = 'Ações rápidas',
  className,
}: {
  actions?: readonly (CampaignHomeActionButtonProps & { id?: string })[]
  ariaLabel?: string
  className?: string
}) => (
  <TooltipProvider delayDuration={300}>
    <div
      aria-label={ariaLabel}
      className={cn(
        'min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      <ul role="list" className="m-0 flex min-w-max list-none snap-x snap-proximity gap-6 p-0 pb-1">
        {actions?.map(({ id, ...button }) => (
          <li key={id ?? button.href ?? button.label} className="m-0 list-none p-0">
            <CampaignHomeActionButton {...button} />
          </li>
        ))}
      </ul>
    </div>
  </TooltipProvider>
)
