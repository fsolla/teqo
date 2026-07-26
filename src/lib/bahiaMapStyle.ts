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

/**
 * Feature key → fill, for the discrete relative scales (B13). When present it
 * REPLACES the continuous ramp: a key absent from the record has no class and
 * renders as "no data", which is not the same as a value of zero.
 */
export type ChoroplethFills = Record<string, string>

export type LayerStyleContext = {
  values: ChoroplethValues
  fillMode: BahiaMapFillMode
  max: number
  fillByKey?: ChoroplethFills
  highlightSet: Set<string>
  selectedKey: string | null
  hoveredKey: string | null
}

const NO_DATA_FILL = '#f4f4f5'

type FeatureStyleInput = {
  metric: number
  highlighted: boolean
  fillMode: BahiaMapFillMode
  max: number
  classFill?: string
  classed: boolean
}

const getFeatureStyle = ({
  metric,
  highlighted,
  fillMode,
  max,
  classFill,
  classed,
}: FeatureStyleInput): PathOptions => ({
  weight: highlighted ? 2 : 1,
  color: highlighted ? '#c51414' : '#a8a29e',
  fillColor: classed
    ? (classFill ?? NO_DATA_FILL)
    : fillMode === 'diverging'
      ? divergingFillColor(metric, max)
      : choroplethFillColor(metric, max),
  fillOpacity: (classed ? classFill !== undefined : metric !== 0) ? 0.78 : 0.35,
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

export const canonicalMapKeysKey = (keys: string[]): string =>
  keys.length > 0 ? [...keys].sort().join(',') : ''

export const keyPropertyForMode = (mode: 'municipality' | 'territory'): FeatureKeyProperty =>
  mode === 'municipality' ? 'codarea' : 'code'

export const featureKeyFromProperties = (
  properties: Record<string, string> | undefined,
  keyProperty: FeatureKeyProperty,
): string | undefined => properties?.[keyProperty]

export const resolvePathStyle = (context: LayerStyleContext, key: string): PathOptions => {
  const classed = context.fillByKey !== undefined

  if (!key) {
    return getFeatureStyle({
      metric: 0,
      highlighted: false,
      fillMode: context.fillMode,
      max: context.max,
      classed,
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
    classFill: context.fillByKey?.[key],
    classed,
  })
}

export const buildLayerStyleContext = ({
  values,
  fillMode,
  scaleMax,
  fillByKey,
  highlightKey,
  selectedKey,
  hoveredKey = null,
}: {
  values: ChoroplethValues
  fillMode: BahiaMapFillMode
  scaleMax?: number
  fillByKey?: ChoroplethFills
  highlightKey: string
  selectedKey: string | null
  hoveredKey?: string | null
}): LayerStyleContext => ({
  values,
  fillMode,
  max: computeChoroplethMax(values, fillMode, scaleMax),
  fillByKey,
  highlightSet: buildHighlightSet(highlightKey),
  selectedKey,
  hoveredKey,
})
