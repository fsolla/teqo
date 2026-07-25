import { PencilIcon } from 'lucide-react'
import Link from 'next/link'

import { StateDeputyChips } from '@/components/campaign/stateDeputy/StateDeputyChips'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  municipalityPriorityLabels,
  politicalTrendBadgeVariant,
  politicalTrendLabels,
} from '@/utilities/municipalityLabels'
import type { MunicipalityDetailViewModel } from '@/utilities/municipalityViewModels'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

export const MunicipalityStrategyCard = ({
  strategy,
  municipalitySlug,
  canEdit,
}: {
  strategy: NonNullable<MunicipalityDetailViewModel['strategy']>
  municipalitySlug: string
  canEdit: boolean
}) => {
  const trend = strategy.politicalTrend

  return (
    <section
      aria-labelledby="municipality-strategy-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="municipality-strategy-title" className="text-base font-medium">
            Estratégia do município
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {strategy.priority === 'alta' ? (
              <Badge variant="destructive">{municipalityPriorityLabels.alta}</Badge>
            ) : (
              <Badge variant="secondary">Prioridade normal</Badge>
            )}
            {trend.status ? (
              <Badge variant={politicalTrendBadgeVariant[trend.status]}>
                Tendência {politicalTrendLabels[trend.status].toLowerCase()}
              </Badge>
            ) : (
              <Badge variant="outline">Tendência não registrada</Badge>
            )}
          </div>
        </div>
        {canEdit ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/campanha/municipios/${municipalitySlug}/editar`}>
              <PencilIcon data-icon="inline-start" aria-hidden="true" />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>

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

      {strategy.stateDeputies.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Dobradinhas</h3>
          <div className="mt-2">
            <StateDeputyChips deputies={strategy.stateDeputies} />
          </div>
        </div>
      ) : null}

      {strategy.dobradinhaNotes ? (
        <div>
          <h3 className="text-sm font-medium">Dobradinhas (notas)</h3>
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
      {strategy.budgetNotes ? (
        <div>
          <h3 className="text-sm font-medium">Emendas aportadas</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {strategy.budgetNotes}
          </p>
        </div>
      ) : null}
    </section>
  )
}
