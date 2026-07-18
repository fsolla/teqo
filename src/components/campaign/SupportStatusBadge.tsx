import { Badge } from '@/components/ui/Badge'
import type { SupportStatus } from '@/lib/schemas/leadership'

export type { SupportStatus } from '@/lib/schemas/leadership'

const statusPresentation = {
  engajado: {
    label: 'Engajado',
    variant: 'support-engaged',
  },
  a_abordar: {
    label: 'A abordar',
    variant: 'support-to-approach',
  },
  em_disputa: {
    label: 'Em disputa',
    variant: 'support-disputed',
  },
  negativo: {
    label: 'Negativo',
    variant: 'support-negative',
  },
} as const

export const SupportStatusBadge = ({ status }: { status: SupportStatus }) => {
  const presentation = statusPresentation[status]

  return (
    <Badge variant={presentation.variant} data-support-status={status}>
      {presentation.label}
    </Badge>
  )
}
