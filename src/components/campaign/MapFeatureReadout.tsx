import Link from 'next/link'

import type { BahiaMapFeatureInfo } from '@/components/campaign/BahiaMap'
import { Button } from '@/components/ui/button'
import { formatElectionNumber } from '@/lib/electionInsights'
import type { PlazaMapNavigation } from '@/utilities/plazaMapNavigation'
import type { PlazaMapScaleMode } from '@/utilities/plazaMapData'

type MapFeatureReadoutProps = {
  feature: BahiaMapFeatureInfo | null
  metricValue: number | undefined
  rawMetricValue: number | undefined
  metricLabel: string
  scaleMode: PlazaMapScaleMode
  comparisonActive: boolean
  navigation: PlazaMapNavigation | null
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

const formatMetricValue = (
  value: number | undefined,
  scaleMode: PlazaMapScaleMode,
  comparisonActive: boolean,
): string => {
  if (value === undefined) return 'Sem dados'
  if (comparisonActive) {
    const prefix = value > 0 ? '+' : ''
    return `${prefix}${formatElectionNumber(value)}`
  }
  if (scaleMode === 'percentValid') return percentFormatter.format(value)
  return formatElectionNumber(value)
}

export const MapFeatureReadout = ({
  feature,
  metricValue,
  rawMetricValue,
  metricLabel,
  scaleMode,
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

  const formattedValue = formatMetricValue(metricValue, scaleMode, comparisonActive)
  const showPercentSecondary =
    !comparisonActive &&
    scaleMode === 'percentValid' &&
    metricValue !== undefined &&
    rawMetricValue !== undefined &&
    rawMetricValue > 0

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
          {!comparisonActive && metricValue !== undefined && scaleMode === 'absolute' ? (
            <span className="text-muted-foreground"> {metricLabel}</span>
          ) : null}
          {!comparisonActive && metricValue !== undefined && scaleMode === 'percentValid' ? (
            <span className="text-muted-foreground"> dos válidos</span>
          ) : null}
          {comparisonActive && metricValue !== undefined ? (
            <span className="text-muted-foreground"> (diferença)</span>
          ) : null}
        </p>
        {showPercentSecondary ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatElectionNumber(rawMetricValue)} votos
          </p>
        ) : null}
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
