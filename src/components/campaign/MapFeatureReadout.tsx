import Link from 'next/link'

import type { BahiaMapFeatureInfo } from '@/components/campaign/BahiaMap'
import { Button } from '@/components/ui/button'
import { formatElectionNumber } from '@/lib/electionInsights'
import type { PlazaMapNavigation } from '@/utilities/plazaMapNavigation'

type MapFeatureReadoutProps = {
  feature: BahiaMapFeatureInfo | null
  metricValue: number | undefined
  metricLabel: string
  comparisonActive: boolean
  navigation: PlazaMapNavigation | null
}

const formatMetricValue = (
  value: number | undefined,
  comparisonActive: boolean,
): string => {
  if (value === undefined) return 'Sem dados'
  if (comparisonActive) {
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${formatElectionNumber(value)}`
  }
  return formatElectionNumber(value)
}

export const MapFeatureReadout = ({
  feature,
  metricValue,
  metricLabel,
  comparisonActive,
  navigation,
}: MapFeatureReadoutProps) => {
  if (!feature) {
    return (
      <p className="min-h-11 content-center text-sm text-muted-foreground" aria-live="polite">
        Passe o cursor ou toque em um município para ver os votos.
      </p>
    )
  }

  const formattedValue = formatMetricValue(metricValue, comparisonActive)

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
      aria-live="polite"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm font-medium">{feature.name}</p>
        <p className="text-sm text-muted-foreground">
          <span className="sr-only">{metricLabel}: </span>
          <span className="tabular-nums">{formattedValue}</span>
          {!comparisonActive && metricValue !== undefined ? (
            <span className="text-muted-foreground"> {metricLabel}</span>
          ) : null}
          {comparisonActive && metricValue !== undefined ? (
            <span className="text-muted-foreground"> (diferença)</span>
          ) : null}
        </p>
        {navigation?.kind === 'zones' ? (
          <p className="text-xs text-muted-foreground">
            Toque de novo no mapa ou role até as Praças por zona abaixo.
          </p>
        ) : null}
      </div>

      {navigation?.kind === 'navigate' ? (
        <Button asChild className="min-h-11 shrink-0">
          <Link href={`/campanha/pracas/${navigation.slug}`}>Abrir Praça</Link>
        </Button>
      ) : null}
    </div>
  )
}
