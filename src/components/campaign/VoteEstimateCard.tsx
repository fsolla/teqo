import { LightbulbIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const voteFormatter = new Intl.NumberFormat('pt-BR')

export type VoteEstimateCardProps = {
  confirmedEstimate?: number | null
  confirmedBy?: string
  confirmedAt?: string
  proposedEstimate?: number | null
  proposedBy?: string
  proposedAt?: string
  action?: React.ReactNode
  className?: string
  focusTargetId?: string
}

const formatVotes = (value: number) => `${voteFormatter.format(value)} votos`

export const VoteEstimateCard = ({
  confirmedEstimate,
  confirmedBy,
  confirmedAt,
  proposedEstimate,
  proposedBy,
  proposedAt,
  action,
  className,
  focusTargetId,
}: VoteEstimateCardProps) => {
  const hasConfirmedEstimate = confirmedEstimate != null
  const hasProposal = proposedEstimate != null
  const confirmationDetails = [
    confirmedBy ? `por ${confirmedBy}` : null,
    confirmedAt ? `em ${confirmedAt}` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Card className={className}>
      <CardHeader>
        <CardDescription>Estimativa de votos</CardDescription>
        <CardTitle id={focusTargetId} tabIndex={focusTargetId ? -1 : undefined}>
          {hasConfirmedEstimate ? formatVotes(confirmedEstimate) : 'Sem estimativa confirmada'}
        </CardTitle>
        {hasConfirmedEstimate ? (
          <CardAction>
            <Badge variant="estimate-confirmed">Confirmada</Badge>
          </CardAction>
        ) : null}
        {confirmationDetails ? <CardDescription>{confirmationDetails}</CardDescription> : null}
      </CardHeader>

      {hasProposal ? (
        <CardContent>
          <Alert variant="pending">
            <LightbulbIcon aria-hidden="true" />
            <AlertTitle>Sugestão pendente</AlertTitle>
            <AlertDescription>
              {formatVotes(proposedEstimate)}
              {proposedBy ? ` por ${proposedBy}` : null}
              {proposedAt ? ` em ${proposedAt}` : null}
            </AlertDescription>
          </Alert>
        </CardContent>
      ) : null}

      {action ? <CardFooter>{action}</CardFooter> : null}
    </Card>
  )
}
