'use client'

import type { ReactNode } from 'react'

import {
  CampaignHomeActionButton,
  type CampaignHomeActionButtonProps,
} from '@/components/campaign/dashboard/CampaignHomeActionButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const CampaignHomeActionStrip = ({
  children,
  actions,
  ariaLabel = 'Ações rápidas',
  className,
}: {
  children?: ReactNode
  actions?: readonly CampaignHomeActionButtonProps[]
  ariaLabel?: string
  className?: string
}) => (
  <TooltipProvider delayDuration={300}>
    <div
      aria-label={ariaLabel}
      className={cn(
        'min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x] [scrollbar-width:thin]',
        className,
      )}
    >
      <ul role="list" className="m-0 flex min-w-max list-none snap-x snap-proximity gap-6 p-0 pb-1">
        {children}
        {actions?.map((action) => (
          <li key={action.href ?? action.label} className="m-0 list-none p-0">
            <CampaignHomeActionButton {...action} />
          </li>
        ))}
      </ul>
    </div>
  </TooltipProvider>
)
