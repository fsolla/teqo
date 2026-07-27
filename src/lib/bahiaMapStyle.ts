import type { PathOptions } from 'leaflet'

import {
  choroplethFillColor,
  choroplethMaxAbsValue,
  choroplethMaxValue,
  divergingFillColor,
  NO_DATA_FILL,
} from '@/lib/choroplethColorScale'

export type ChoroplethValues = Record<string, number>

export type BahiaMapFillMode = 'sequential' | 'diverging'

/** Properties that carry a map key, most specific first (see `featureMapKey`). */
const MAP_KEY_PROPERTIES = ['municipalitySlug', 'codarea', 'code'] as const

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

/**
 * B13 — proportional symbols scale by the SQUARE ROOT of the magnitude, so the
 * AREA of the circle carries the value: sizing the radius directly would make
 * a município with twice the votes look four times as big. Flannery's
 * perceptual correction is deliberately skipped — it inflates the large end on
 * purpose, and here the exact number is one hover away in the readout.
 *
 * Lives here rather than in the Leaflet component because the legend draws its
 * reference circles from the same formula; two implementations would let the
 * key claim a size the map does not paint.
 */
const BUBBLE_MAX_RADIUS = 16

/** Small enough that a crowded east reads as texture, not as a second choropleth. */
const BUBBLE_MIN_RADIUS = 1.5

export const bubbleRadius = (value: number, max: number): number =>
  max > 0 ? Math.max(BUBBLE_MIN_RADIUS, BUBBLE_MAX_RADIUS * Math.sqrt(value / max)) : 0

export const buildHighlightSet = (highlightKey: string): Set<string> =>
  new Set(highlightKey.length > 0 ? highlightKey.split(',').filter(Boolean) : [])

export const canonicalMapKeysKey = (keys: string[]): string =>
  keys.length > 0 ? [...keys].sort().join(',') : ''

/**
 * The key a feature is painted and addressed by, whichever mesh it came from:
 * a zone municipality carries `municipalitySlug` (B8 F2 — the whole city shares
 * one codarea, so the code cannot identify it), a município `codarea`, an
 * identity territory `code`. The three never coexist on one feature, so no mode
 * argument is needed.
 */
export const featureMapKey = (
  properties: Record<string, unknown> | undefined | null,
): string | undefined => {
  for (const property of MAP_KEY_PROPERTIES) {
    const value = properties?.[property]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

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
