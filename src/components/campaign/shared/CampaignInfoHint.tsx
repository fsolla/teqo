'use client'

import { CircleHelpIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'

/** Touch-friendly “?” info (Popover, not hover-only Tooltip). */
export const CampaignInfoHint = ({ label, children }: { label: string; children: ReactNode }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 min-h-11 min-w-11 shrink-0 text-muted-foreground hover:text-foreground"
        aria-label={label}
      >
        <CircleHelpIcon className="size-4" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-64 p-3 text-sm leading-snug">
      {children}
    </PopoverContent>
  </Popover>
)
