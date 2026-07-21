import { PencilIcon } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { StaffPlazaVotesDisplay } from '@/components/campaign/StaffPlazaVotesDisplay'
import { plazaPriorityLabels, politicalTrendLabels } from '@/utilities/plazaUi'
import type { PlazaDetailViewModel } from '@/utilities/plazaViewModels'

const voteFormatter = new Intl.NumberFormat('pt-BR')
const dateFormatter = new Intl.DateTimeFormat('pt-BR')

const trendVariant = {
  favoravel: 'estimate-confirmed',
  neutra: 'secondary',
  desfavoravel: 'destructive',
} as const

export const PlazaStrategyCard = ({
  strategy,
  plazaSlug,
  canEdit,
  leadershipVoteTotal,
}: {
  strategy: NonNullable<PlazaDetailViewModel['strategy']>
  plazaSlug: string
  canEdit: boolean
  leadershipVoteTotal: number
}) => {
  const goals = strategy.voteGoals
  const trend = strategy.politicalTrend

  return (
    <section
      aria-labelledby="plaza-strategy-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="plaza-strategy-title" className="text-base font-medium">
            Estratégia da Praça
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {strategy.priority === 'alta' ? (
              <Badge variant="destructive">{plazaPriorityLabels.alta}</Badge>
            ) : (
              <Badge variant="secondary">Prioridade normal</Badge>
            )}
            {trend.status ? (
              <Badge variant={trendVariant[trend.status]}>
                Tendência {politicalTrendLabels[trend.status].toLowerCase()}
              </Badge>
            ) : (
              <Badge variant="outline">Tendência não registrada</Badge>
            )}
          </div>
        </div>
        {canEdit ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/campanha/pracas/${plazaSlug}/editar`}>
              <PencilIcon data-icon="inline-start" aria-hidden="true" />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 px-3 py-2 sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Votos estimados</dt>
          <dd>
            <StaffPlazaVotesDisplay
              expectedVotes={strategy.expectedVotes}
              leadershipEffectiveTotal={leadershipVoteTotal}
            />
          </dd>
        </div>
        {(
          [
            ['Meta Bom', goals.good],
            ['Meta Regular', goals.regular],
            ['Meta Mínimo', goals.minimum],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="text-lg font-medium tabular-nums">
              {value == null ? '—' : voteFormatter.format(value)}
            </dd>
          </div>
        ))}
      </dl>

      {trend.status || trend.note ? (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Tendência política</h3>
          {trend.note ? (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{trend.note}</p>
          ) : null}
          {trend.recordedAt ? (
            <p className="text-xs text-muted-foreground">
              Registrada {trend.recordedByName ? `por ${trend.recordedByName} ` : ''}em{' '}
              {dateFormatter.format(new Date(trend.recordedAt))}
            </p>
          ) : null}
        </div>
      ) : null}

      {strategy.strengths.length > 0 || strategy.risks.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {strategy.strengths.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium">Forças</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {strategy.strengths.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {strategy.risks.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium">Riscos</h3>
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {strategy.risks.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {strategy.dobradinhaNotes ? (
        <div>
          <h3 className="text-sm font-medium">Dobradinhas</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {strategy.dobradinhaNotes}
          </p>
        </div>
      ) : null}
      {strategy.nextSteps ? (
        <div>
          <h3 className="text-sm font-medium">Encaminhamentos</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {strategy.nextSteps}
          </p>
        </div>
      ) : null}
    </section>
  )
}
