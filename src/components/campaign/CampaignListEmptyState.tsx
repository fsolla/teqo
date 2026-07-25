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

/**
 * The standard campaign list empty state (icon, title, description, optional
 * CTA). Rendered inside `CampaignListResults` so it dims with the shared
 * transition like the rows it replaces.
 */
export const CampaignListEmptyState = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description: ReactNode
  /** Call-to-action button(s). */
  children?: ReactNode
}) => (
  <Empty className="min-h-72 border">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <Icon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>{description}</EmptyDescription>
    </EmptyHeader>
    {children ? <EmptyContent>{children}</EmptyContent> : null}
  </Empty>
)
