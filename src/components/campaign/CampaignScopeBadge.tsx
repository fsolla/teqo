import { EyeIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type CampaignScopeBadgeProps = React.ComponentProps<'span'>

export const CampaignScopeBadge = ({ children, className, ...props }: CampaignScopeBadgeProps) => (
  <Badge
    variant="scope"
    data-scope="campaign"
    className={cn('h-auto min-h-7 whitespace-normal px-3 py-1', className)}
    {...props}
  >
    <EyeIcon data-icon="inline-start" aria-hidden="true" />
    {children}
  </Badge>
)
