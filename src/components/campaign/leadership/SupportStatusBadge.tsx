import { Badge } from '@/components/ui/Badge'
import type { SupportStatus } from '@/lib/schemas/leadership'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

export type { SupportStatus } from '@/lib/schemas/leadership'

// Labels live in `leadershipLabels.ts` (shared with the ficha forms and the
// list quick-edit control) — this table only adds the badge-specific variant.
const statusPresentation = {
  engajado: { variant: 'support-engaged' },
  a_abordar: { variant: 'support-to-approach' },
  em_disputa: { variant: 'support-disputed' },
  lembranca: { variant: 'support-remembered' },
  negativo: { variant: 'support-negative' },
} as const

export const SupportStatusBadge = ({ status }: { status: SupportStatus }) => {
  const presentation = statusPresentation[status]

  return (
    <Badge variant={presentation.variant} data-support-status={status}>
      {supportStatusLabels[status]}
    </Badge>
  )
}
