import { Badge } from '@/components/ui/Badge'
import { reelStatusLabels, type ReelStatus } from '@/lib/reel'

type StatusBadgeVariant = 'default' | 'outline'

const variantFor = (status: ReelStatus): StatusBadgeVariant =>
  status === 'published' ? 'default' : 'outline'

/** C194 — the one status chip of the reel library (list and detail). */
export const ReelStatusBadge = ({ status }: { status: ReelStatus }) => (
  <Badge variant={variantFor(status)} className="font-normal">
    {reelStatusLabels[status]}
  </Badge>
)
