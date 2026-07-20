'use client'

import { useMemo, useState } from 'react'

import { BahiaMap, type BahiaMapMode } from '@/components/campaign/BahiaMap'
import { ChoroplethLegend } from '@/components/campaign/ChoroplethLegend'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { choroplethMaxValue } from '@/lib/choroplethColorScale'
import {
  choroplethMetricLabels,
  type ChoroplethMetric,
  type NucleusChoroplethBundle,
} from '@/utilities/nucleusChoroplethTypes'

const modeLabels: Record<BahiaMapMode, string> = {
  municipality: 'Municípios',
  territory: 'Territórios de Identidade',
}

type ChoroplethMapControlsProps = {
  mode: BahiaMapMode
  metric: ChoroplethMetric
  max: number
  onModeChange: (mode: BahiaMapMode) => void
  onMetricChange: (metric: ChoroplethMetric) => void
  idPrefix: string
}

const ChoroplethMapControls = ({
  mode,
  metric,
  max,
  onModeChange,
  onMetricChange,
  idPrefix,
}: ChoroplethMapControlsProps) => {
  const hasData = max > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel htmlFor={`${idPrefix}-mode`}>Visualização</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-mode`}
            value={mode}
            onChange={(event) => onModeChange(event.target.value as BahiaMapMode)}
            className="min-h-11 w-full"
          >
            {(Object.keys(modeLabels) as BahiaMapMode[]).map((entry) => (
              <NativeSelectOption key={entry} value={entry}>
                {modeLabels[entry]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field className="min-w-[12rem] flex-1">
          <FieldLabel htmlFor={`${idPrefix}-metric`}>Métrica</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-metric`}
            value={metric}
            onChange={(event) => onMetricChange(event.target.value as ChoroplethMetric)}
            className="min-h-11 w-full"
          >
            {(Object.keys(choroplethMetricLabels) as ChoroplethMetric[]).map((entry) => (
              <NativeSelectOption key={entry} value={entry}>
                {choroplethMetricLabels[entry]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {hasData ? (
        <ChoroplethLegend max={max} metricLabel={choroplethMetricLabels[metric]} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Sem dados para esta métrica no conjunto atual.
        </p>
      )}
    </div>
  )
}

type ChoroplethMapPanelProps = {
  bundle: NucleusChoroplethBundle
  title: string
  description: string
  ariaLabel: string
  idPrefix: string
  defaultMode?: BahiaMapMode
  defaultMetric?: ChoroplethMetric
  highlightKeys?: string[]
  heightClassName?: string
}

export const ChoroplethMapPanel = ({
  bundle,
  title,
  description,
  ariaLabel,
  idPrefix,
  defaultMode = 'municipality',
  defaultMetric = 'nucleusCount',
  highlightKeys = [],
  heightClassName,
}: ChoroplethMapPanelProps) => {
  const [mode, setMode] = useState<BahiaMapMode>(defaultMode)
  const [metric, setMetric] = useState<ChoroplethMetric>(defaultMetric)

  const values = useMemo(
    () => (mode === 'municipality' ? bundle.municipality[metric] : bundle.territory[metric]),
    [bundle, metric, mode],
  )
  const max = choroplethMaxValue(values)

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id={`${idPrefix}-title`} className="text-base font-medium">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChoroplethMapControls
        mode={mode}
        metric={metric}
        max={max}
        onModeChange={setMode}
        onMetricChange={setMetric}
        idPrefix={idPrefix}
      />
      <BahiaMap
        mode={mode}
        values={values}
        highlightKeys={highlightKeys}
        ariaLabel={ariaLabel}
        heightClassName={heightClassName}
      />
    </section>
  )
}
