import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type CampaignListPageHeaderProps = {
  title: string
  description: string
  scope?: ReactNode
  actions?: ReactNode
  className?: string
  titleClassName?: string
  descriptionClassName?: string
}

export const CampaignListPageHeader = ({
  title,
  description,
  scope,
  actions,
  className,
  titleClassName,
  descriptionClassName,
}: CampaignListPageHeaderProps) => (
  <header
    className={cn(
      'flex flex-col gap-2',
      actions && 'gap-4 sm:flex-row sm:items-start sm:justify-between',
      className,
    )}
  >
    <div className="flex flex-col gap-2">
      <h1
        className={cn(
          'sr-only text-2xl font-semibold tracking-tight md:not-sr-only',
          titleClassName,
        )}
      >
        {title}
      </h1>
      <p className={cn('hidden text-muted-foreground md:block', descriptionClassName)}>
        {description}
      </p>
      {scope ? <div className="hidden md:contents">{scope}</div> : null}
    </div>
    {actions}
  </header>
)
