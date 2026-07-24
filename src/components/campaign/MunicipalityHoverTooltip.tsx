'use client'

import type { ReactElement, ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

/** Hover/focus explanation with no extra chrome — wraps an existing control or heading. */
export const MunicipalityHoverTooltip = ({
  content,
  children,
  side = 'bottom',
  align = 'center',
}: {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-xs text-left font-normal">
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
)
