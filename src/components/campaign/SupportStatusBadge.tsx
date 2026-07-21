import { Badge } from '@/components/ui/Badge'
import type { SupportStatus } from '@/lib/schemas/leadership'

export type { SupportStatus } from '@/lib/schemas/leadership'

const statusPresentation = {
  engajado: {
    label: 'Engajado',
    variant: 'support-engaged',
    summary: 'Participa ativamente da campanha nas suas Praças e pode ter acesso ao app.',
  },
  a_abordar: {
    label: 'A abordar',
    variant: 'support-to-approach',
    summary: 'Cadastrado, mas o engajamento ainda não foi confirmado.',
  },
  em_disputa: {
    label: 'Em disputa',
    variant: 'support-disputed',
    summary: 'Apoio contestado, incerto ou em negociação.',
  },
  negativo: {
    label: 'Negativo',
    variant: 'support-negative',
    summary: 'Declarou não apoiar ou recusou o contato.',
  },
} as const

export const supportStatusLabel = (status: SupportStatus): string =>
  statusPresentation[status].label

export const supportStatusSummary = (status: SupportStatus): string =>
  statusPresentation[status].summary

export const SupportStatusBadge = ({ status }: { status: SupportStatus }) => {
  const presentation = statusPresentation[status]

  return (
    <Badge variant={presentation.variant} data-support-status={status}>
      {presentation.label}
    </Badge>
  )
}
