import type { PathOptions } from 'leaflet'

import {
  choroplethFillColor,
  choroplethMaxAbsValue,
  choroplethMaxValue,
  divergingFillColor,
} from '@/lib/choroplethColorScale'

export type ChoroplethValues = Record<string, number>

export type BahiaMapFillMode = 'sequential' | 'diverging'

export type FeatureKeyProperty = 'codarea' | 'code'

export type LayerStyleContext = {
  values: ChoroplethValues
  fillMode: BahiaMapFillMode
  max: number
  highlightSet: Set<string>
  selectedKey: string | null
  hoveredKey: string | null
}

type FeatureStyleInput = {
  metric: number
  highlighted: boolean
  fillMode: BahiaMapFillMode
  max: number
}

export const getFeatureStyle = ({
  metric,
  highlighted,
  fillMode,
  max,
}: FeatureStyleInput): PathOptions => ({
  weight: highlighted ? 2.5 : 1,
  color: highlighted ? '#c51414' : '#a8a29e',
  fillColor:
    fillMode === 'diverging'
      ? divergingFillColor(metric, max)
      : choroplethFillColor(metric, max),
  fillOpacity: highlighted ? 0.92 : metric !== 0 ? 0.78 : 0.35,
})

export const computeChoroplethMax = (
  values: ChoroplethValues,
  fillMode: BahiaMapFillMode,
  scaleMax?: number,
): number =>
  scaleMax ??
  (fillMode === 'diverging' ? choroplethMaxAbsValue(values) : choroplethMaxValue(values))

export const buildHighlightSet = (highlightKey: string): Set<string> =>
  new Set(highlightKey.length > 0 ? highlightKey.split(',').filter(Boolean) : [])

export const keyPropertyForMode = (mode: 'municipality' | 'territory'): FeatureKeyProperty =>
  mode === 'municipality' ? 'codarea' : 'code'

export const featureKeyFromProperties = (
  properties: Record<string, string> | undefined,
  keyProperty: FeatureKeyProperty,
): string | undefined => properties?.[keyProperty]

export const resolvePathStyle = (context: LayerStyleContext, key: string): PathOptions => {
  if (!key) {
    return getFeatureStyle({
      metric: 0,
      highlighted: false,
      fillMode: context.fillMode,
      max: context.max,
    })
  }

  const activeKey = context.hoveredKey ?? context.selectedKey
  const metric = context.values[key] ?? 0
  const highlighted = context.highlightSet.has(key) || key === activeKey

  return getFeatureStyle({
    metric,
    highlighted,
    fillMode: context.fillMode,
    max: context.max,
  })
}

export const buildLayerStyleContext = ({
  values,
  fillMode,
  scaleMax,
  highlightKey,
  selectedKey,
  hoveredKey = null,
}: {
  values: ChoroplethValues
  fillMode: BahiaMapFillMode
  scaleMax?: number
  highlightKey: string
  selectedKey: string | null
  hoveredKey?: string | null
}): LayerStyleContext => ({
  values,
  fillMode,
  max: computeChoroplethMax(values, fillMode, scaleMax),
  highlightSet: buildHighlightSet(highlightKey),
  selectedKey,
  hoveredKey,
})
