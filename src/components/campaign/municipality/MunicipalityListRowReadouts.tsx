'use client'

import { CircleAlertIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  formatTerritorialClassWhy,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipality/municipalityLabels'
import {
  formatMunicipalitySignalAgeLabel,
  isMunicipalitySignalCold,
  MUNICIPALITY_COLD_SIGNAL_DAYS,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'
import type { MunicipalityListViewModel } from '@/utilities/municipality/municipalityViewModels'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

/** E10 classe readout — table column (mobile card dropped classe in B120). */
export const TerritorialClassReadout = ({
  municipality,
}: {
  municipality: MunicipalityListViewModel
}) => {
  const why = formatTerritorialClassWhy(municipality.territorialClassFactors)

  if (municipality.territorialClass === 'sem_base') {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{why}</span>
      </span>
    )
  }

  return (
    <>
      <Badge variant={territorialClassBadgeVariant[municipality.territorialClass]}>
        {territorialClassLabels[municipality.territorialClass]}
      </Badge>
      <span className="sr-only">{why}</span>
    </>
  )
}

/** E9 frescor readout — shared by the table column and the mobile card. */
export const SignalAgeReadout = ({
  lastSignalAt,
  layout,
}: {
  lastSignalAt: string | null
  layout: 'table' | 'card'
}) => {
  const ageInDays = municipalitySignalAgeInDays(lastSignalAt)
  const isCold = isMunicipalitySignalCold(ageInDays)
  const ageLabel = formatMunicipalitySignalAgeLabel(ageInDays)
  const dateLabel = lastSignalAt ? dateFormatter.format(new Date(lastSignalAt)) : null

  return (
    <div
      data-signal={isCold ? 'cold' : 'fresh'}
      className={cn('flex flex-col gap-0.5', layout === 'card' && 'text-sm')}
      title={
        isCold
          ? `Sem registro novo há ${MUNICIPALITY_COLD_SIGNAL_DAYS} dias ou mais — atualização da equipe ou declaração de liderança.`
          : undefined
      }
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 tabular-nums',
          isCold ? 'font-medium text-estimate-pending-foreground' : 'text-foreground',
        )}
      >
        {isCold ? <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {ageLabel}
      </span>
      {dateLabel ? (
        <span className="text-xs text-muted-foreground tabular-nums">{dateLabel}</span>
      ) : null}
    </div>
  )
}
