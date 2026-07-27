import Link from 'next/link'

import type { BahiaMapFeatureInfo } from '@/components/campaign/map/BahiaMap'
import { Button } from '@/components/ui/button'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { MunicipalityMapScaleMode } from '@/utilities/municipalityMapContract'

type MapFeatureReadoutProps = {
  feature: BahiaMapFeatureInfo | null
  metricValue: number | undefined
  rawMetricValue: number | undefined
  metricLabel: string
  scaleMode: MunicipalityMapScaleMode
  /**
   * What the colour means for THIS município, spelled out — "4ª de 5 faixas",
   * "1,8× o padrão estadual do candidato", "12º entre 663 candidatos". A class
   * without its reason is a verdict the reader cannot check.
   */
  relativeReading: string | null
  /** What the bubble encodes for THIS município — only while the layer is on. */
  bubbleReading: string | null
  comparisonActive: boolean
  /** The município the painted feature opens, when it is one the actor can read. */
  municipalitySlug: string | undefined
}

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

const formatMetricValue = (
  value: number | undefined,
  scaleMode: MunicipalityMapScaleMode,
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
  relativeReading,
  bubbleReading,
  comparisonActive,
  municipalitySlug,
}: MapFeatureReadoutProps) => {
  if (!feature) {
    return (
      <p className="min-h-11 content-center text-sm text-muted-foreground" aria-live="polite">
        Passe o cursor ou toque em um município para ver os votos.
      </p>
    )
  }

  const formattedValue = formatMetricValue(metricValue, scaleMode, comparisonActive)
  // Every mode except the percentage prints the metric next to the number, so
  // announcing it again would read it twice.
  const showMetricLabel =
    !comparisonActive && metricValue !== undefined && scaleMode !== 'percentValid'
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
          {showMetricLabel ? null : <span className="sr-only">{metricLabel}: </span>}
          <span className="tabular-nums">{formattedValue}</span>
          {showMetricLabel ? <span className="text-muted-foreground"> {metricLabel}</span> : null}
          {!comparisonActive && metricValue !== undefined && scaleMode === 'percentValid' ? (
            <span className="text-muted-foreground"> dos válidos</span>
          ) : null}
          {comparisonActive && metricValue !== undefined ? (
            <span className="text-muted-foreground"> (diferença)</span>
          ) : null}
          {relativeReading ? (
            <span className="text-muted-foreground"> · {relativeReading}</span>
          ) : null}
        </p>
        {showPercentSecondary ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatElectionNumber(rawMetricValue)} votos
          </p>
        ) : null}
        {/* The bubble's own line: mixing "votes he got" and "votes at stake"
            into one sentence is how a reader ends up quoting the wrong one. */}
        {bubbleReading ? <p className="text-xs text-muted-foreground">{bubbleReading}</p> : null}
      </div>

      {municipalitySlug ? (
        <Button asChild className="min-h-11 shrink-0">
          <Link href={`/campanha/municipios/${municipalitySlug}`}>Abrir município</Link>
        </Button>
      ) : null}
    </div>
  )
}
