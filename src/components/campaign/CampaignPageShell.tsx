import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const campaignPageShellClassName = 'mr-auto flex w-full max-w-screen-2xl flex-col gap-8'

export const campaignPrioritySurfaceClassName =
  'shadow-[0_4px_24px_rgb(28_25_23/0.08)] ring-1 ring-foreground/10'

export const CampaignPageShell = ({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
} & Omit<ComponentProps<'div'>, 'children' | 'className'>) => (
  <div className={cn(campaignPageShellClassName, className)} {...props}>
    {children}
  </div>
)
