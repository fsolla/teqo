import { AlertTriangleIcon, Clock3Icon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TseZoneBadge } from '@/components/campaign/TseZoneBadge'
import { cn } from '@/lib/utils'
import { nucleusPriorityLabels } from '@/utilities/nucleusUi'

const voteFormatter = new Intl.NumberFormat('pt-BR')

export type NucleusCardProps = {
  name: string
  territory: string
  organization?: string
  tseZones?: number[]
  confirmedVoteEstimate?: number | null
  hasPendingEstimate?: boolean
  isHighPriority?: boolean
  lastUpdateLabel?: string
  isUpdateOverdue?: boolean
  leadershipCounts?: {
    engaged: number
    toApproach: number
    disputed?: number
  }
  actions?: React.ReactNode
  className?: string
}

export const NucleusCard = ({
  name,
  territory,
  organization,
  tseZones = [],
  confirmedVoteEstimate,
  hasPendingEstimate = false,
  isHighPriority = false,
  lastUpdateLabel,
  isUpdateOverdue = false,
  leadershipCounts,
  actions,
  className,
}: NucleusCardProps) => (
  <Card className={className}>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardTitle>{name}</CardTitle>
        {isHighPriority ? <Badge variant="destructive">{nucleusPriorityLabels.alta}</Badge> : null}
      </div>
      <CardDescription>{[organization, territory].filter(Boolean).join(' · ')}</CardDescription>
      {tseZones.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tseZones.map((zoneNumber) => (
            <TseZoneBadge key={zoneNumber} zoneNumber={zoneNumber} />
          ))}
        </div>
      ) : (
        <Badge variant="tse">Sem Zona TSE</Badge>
      )}
    </CardHeader>

    <CardContent className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xl font-bold tabular-nums">
          {confirmedVoteEstimate == null
            ? 'Sem estimativa confirmada'
            : `${voteFormatter.format(confirmedVoteEstimate)} votos`}
        </span>
        {hasPendingEstimate ? <Badge variant="estimate-pending">Sugestão pendente</Badge> : null}
      </div>

      {leadershipCounts ? (
        <p className="m-0 text-sm">
          <strong>{leadershipCounts.engaged} engajadas</strong>
          {' · '}
          {leadershipCounts.toApproach} a abordar
          {leadershipCounts.disputed != null ? ` · ${leadershipCounts.disputed} em disputa` : null}
        </p>
      ) : null}

      {lastUpdateLabel ? (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            isUpdateOverdue && 'font-medium text-cadence-overdue',
          )}
        >
          {isUpdateOverdue ? (
            <AlertTriangleIcon aria-hidden="true" />
          ) : (
            <Clock3Icon aria-hidden="true" />
          )}
          <span>
            {isUpdateOverdue ? 'Atualização atrasada · ' : null}
            {lastUpdateLabel}
          </span>
        </div>
      ) : null}
    </CardContent>

    {actions ? <CardFooter className="flex-wrap gap-2">{actions}</CardFooter> : null}
  </Card>
)
