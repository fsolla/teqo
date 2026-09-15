import { Badge } from '@/components/ui/Badge'
import { speechCutStatusLabels, type SpeechCutStatus } from '@/lib/speechCut'

type StatusBadgeVariant = 'default' | 'destructive' | 'outline'

const variantFor = (status: SpeechCutStatus): StatusBadgeVariant => {
  switch (status) {
    case 'published':
      return 'default'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}

/** C168 — the one status chip of the cut library (list and detail). */
export const SpeechCutStatusBadge = ({
  status,
  className = 'font-normal',
}: {
  status: SpeechCutStatus
  className?: string
}) => (
  <Badge variant={variantFor(status)} className={className}>
    {speechCutStatusLabels[status]}
  </Badge>
)
