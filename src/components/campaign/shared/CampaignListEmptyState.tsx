import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { cn } from '@/lib/utils'

/**
 * The standard campaign list empty state (icon, title, description, optional
 * CTA). Rendered inside `CampaignListResults` so it dims with the shared
 * transition like the rows it replaces. `className` / `mediaClassName` /
 * `contentClassName` let a caller tune the shell without forking it (C192).
 */
export const CampaignListEmptyState = ({
  icon: Icon,
  title,
  description,
  children,
  className,
  mediaClassName,
  contentClassName,
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  /** Call-to-action button(s). */
  children?: ReactNode
  className?: string
  mediaClassName?: string
  contentClassName?: string
}) => (
  <Empty className={cn('min-h-72 border', className)}>
    <EmptyHeader>
      <EmptyMedia variant="icon" className={mediaClassName}>
        <Icon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {children ? <EmptyContent className={contentClassName}>{children}</EmptyContent> : null}
  </Empty>
)
