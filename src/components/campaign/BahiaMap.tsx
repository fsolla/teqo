'use client'

import type { Feature } from 'geojson'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'

import 'leaflet/dist/leaflet.css'

import {
  loadMunicipalityGeometryModule,
  loadTerritoryGeometryModule,
  type MunicipalityGeometryModule,
  type TerritoryGeometryModule,
} from '@/lib/bahiaGeometries'
import {
  choroplethFillColor,
  choroplethMaxAbsValue,
  choroplethMaxValue,
  divergingFillColor,
} from '@/lib/choroplethColorScale'
import { cn } from '@/lib/utils'

export type ChoroplethValues = Record<string, number>

const BAHIA_BOUNDS: L.LatLngBoundsExpression = [
  [-18.5, -46.8],
  [-8.5, -37.0],
]

export type BahiaMapMode = 'municipality' | 'territory'

type FeatureKeyProperty = 'codarea' | 'code'

const featureKey = (
  properties: Record<string, string> | undefined,
  keyProperty: FeatureKeyProperty,
): string | undefined => properties?.[keyProperty]

export type BahiaMapFillMode = 'sequential' | 'diverging'

export type BahiaMapFeatureInfo = {
  key: string
  name: string
}

type FeatureStyleInput = {
  metric: number
  highlighted: boolean
  fillMode: BahiaMapFillMode
  max: number
}

const getFeatureStyle = ({
  metric,
  highlighted,
  fillMode,
  max,
}: FeatureStyleInput): L.PathOptions => ({
  weight: highlighted ? 2.5 : 1,
  color: highlighted ? '#c51414' : '#a8a29e',
  fillColor:
    fillMode === 'diverging'
      ? divergingFillColor(metric, max)
      : choroplethFillColor(metric, max),
  fillOpacity: highlighted ? 0.92 : metric !== 0 ? 0.78 : 0.35,
})

type BahiaMapProps = {
  mode: BahiaMapMode
  values: ChoroplethValues
  /** 'diverging': positive = campaign red, negative = blue, zero = white. */
  fillMode?: BahiaMapFillMode
  highlightKeys?: string[]
  selectedKey?: string | null
  onFeatureSelect?: (info: BahiaMapFeatureInfo | null) => void
  onFeatureActivate?: (key: string) => void
  className?: string
  heightClassName?: string
  ariaLabel: string
}

type LayerStyleContext = {
  values: ChoroplethValues
  fillMode: BahiaMapFillMode
  max: number
  keyProperty: FeatureKeyProperty
  highlightSet: Set<string>
  selectedKey: string | null
  hoveredKey: string | null
}

const resolveLayerKey = (
  layer: L.Layer,
  keyProperty: FeatureKeyProperty,
): string | undefined => {
  if (!(layer instanceof L.Path)) return undefined
  const feature = (layer as L.Path & { feature?: Feature }).feature
  const properties = feature?.properties as Record<string, string> | undefined
  return featureKey(properties, keyProperty)
}

const applyLayerStyles = (layer: L.GeoJSON, context: LayerStyleContext) => {
  const activeKey = context.hoveredKey ?? context.selectedKey

  layer.eachLayer((featureLayer) => {
    if (!(featureLayer instanceof L.Path)) return

    const key = resolveLayerKey(featureLayer, context.keyProperty)
    const metric = key ? (context.values[key] ?? 0) : 0
    const highlighted = key
      ? context.highlightSet.has(key) || key === activeKey
      : false

    featureLayer.setStyle(
      getFeatureStyle({
        metric,
        highlighted,
        fillMode: context.fillMode,
        max: context.max,
      }),
    )
  })
}

const getPointerType = (event: L.LeafletMouseEvent, fallback = 'mouse') =>
  event.originalEvent instanceof PointerEvent ? event.originalEvent.pointerType : fallback

export const BahiaMap = ({
  mode,
  values,
  fillMode = 'sequential',
  highlightKeys = [],
  selectedKey = null,
  onFeatureSelect,
  onFeatureActivate,
  className,
  heightClassName = 'h-[320px]',
  ariaLabel,
}: BahiaMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const styleContextRef = useRef<LayerStyleContext | null>(null)
  const touchPinnedRef = useRef(false)
  const onFeatureSelectRef = useRef(onFeatureSelect)
  const onFeatureActivateRef = useRef(onFeatureActivate)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const highlightKey = useMemo(() => highlightKeys.slice().sort().join(','), [highlightKeys])

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect
    onFeatureActivateRef.current = onFeatureActivate
  }, [onFeatureActivate, onFeatureSelect])

  const refreshLayerStyles = () => {
    const layer = layerRef.current
    const context = styleContextRef.current
    if (!layer || !context) return
    applyLayerStyles(layer, context)
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return

    const map = L.map(container, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    map.fitBounds(BAHIA_BOUNDS, { padding: [16, 16] })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    mapRef.current = map

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize()
          })
        : null
    resizeObserver?.observe(container)

    return () => {
      resizeObserver?.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      styleContextRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let cancelled = false
    setStatus('loading')

    const renderLayer = async () => {
      try {
        const geometryModule =
          mode === 'municipality'
            ? await loadMunicipalityGeometryModule()
            : await loadTerritoryGeometryModule()

        if (cancelled) return

        layerRef.current?.remove()

        const max =
          fillMode === 'diverging' ? choroplethMaxAbsValue(values) : choroplethMaxValue(values)
        const keyProperty: FeatureKeyProperty = mode === 'municipality' ? 'codarea' : 'code'
        const highlightSet = new Set(
          highlightKey.length > 0 ? highlightKey.split(',').filter(Boolean) : [],
        )

        const styleContext: LayerStyleContext = {
          values,
          fillMode,
          max,
          keyProperty,
          highlightSet,
          selectedKey,
          hoveredKey: null,
        }
        styleContextRef.current = styleContext

        const emphasizeFeature = (featureLayer: L.Path, nextKey: string) => {
          const context = styleContextRef.current
          if (!context) return

          const alreadyEmphasized = context.hoveredKey === nextKey
          context.hoveredKey = nextKey
          if (!alreadyEmphasized) {
            refreshLayerStyles()
            featureLayer.bringToFront()
          }
        }

        const layer = L.geoJSON([...geometryModule.features], {
          style: (feature?: Feature) => {
            const properties = feature?.properties as Record<string, string> | undefined
            const key = featureKey(properties, keyProperty)
            const metric = key ? (values[key] ?? 0) : 0
            const highlighted = key ? highlightSet.has(key) || key === selectedKey : false

            return getFeatureStyle({
              metric,
              highlighted,
              fillMode,
              max,
            })
          },
          onEachFeature: (feature, featureLayer) => {
            if (!(featureLayer instanceof L.Path)) return

            const properties = feature.properties as Record<string, string> | undefined
            const key = featureKey(properties, keyProperty)
            if (!key) return

            const name = properties?.name ?? key

            featureLayer.on('mouseover', (event) => {
              const pointerType = getPointerType(event)
              if (pointerType === 'mouse') {
                touchPinnedRef.current = false
              } else if (touchPinnedRef.current) {
                return
              }

              if (styleContextRef.current?.hoveredKey === key) return

              emphasizeFeature(featureLayer, key)
              onFeatureSelectRef.current?.({ key, name })
            })

            featureLayer.on('mouseout', () => {
              if (touchPinnedRef.current) return
              if (styleContextRef.current) {
                styleContextRef.current.hoveredKey = null
              }
              refreshLayerStyles()
              onFeatureSelectRef.current?.(null)
            })

            featureLayer.on('click', (event) => {
              touchPinnedRef.current = getPointerType(event, 'mouse') === 'touch'

              emphasizeFeature(featureLayer, key)
              onFeatureActivateRef.current?.(key)
              onFeatureSelectRef.current?.({ key, name })
            })
          },
        })

        layer.addTo(map)
        layerRef.current = layer

        map.invalidateSize()

        if (highlightSet.size > 0) {
          const highlightedFeatures =
            mode === 'municipality'
              ? [...highlightSet].flatMap((key) => {
                  const feature = (
                    geometryModule as MunicipalityGeometryModule
                  ).getMunicipalityFeature(key)
                  return feature ? [feature] : []
                })
              : [...highlightSet].flatMap((key) => {
                  const feature = (geometryModule as TerritoryGeometryModule).getTerritoryFeature(
                    key,
                  )
                  return feature ? [feature] : []
                })
          if (highlightedFeatures.length > 0) {
            const highlightBounds = L.geoJSON(highlightedFeatures).getBounds()
            if (highlightBounds.isValid()) {
              map.fitBounds(highlightBounds, { padding: [24, 24], maxZoom: 10 })
            }
          }
        } else {
          map.fitBounds(BAHIA_BOUNDS, { padding: [16, 16] })
        }

        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void renderLayer()

    return () => {
      cancelled = true
      layerRef.current?.remove()
      layerRef.current = null
      styleContextRef.current = null
    }
  }, [fillMode, highlightKey, mode, values])

  useEffect(() => {
    const context = styleContextRef.current
    if (!context || context.selectedKey === selectedKey) return

    context.selectedKey = selectedKey
    if (context.hoveredKey) return
    refreshLayerStyles()
  }, [selectedKey])

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel}
        aria-busy={status === 'loading'}
        className={cn(
          'w-full overflow-hidden rounded-lg border border-border bg-muted/30 [&_.leaflet-interactive]:cursor-pointer',
          heightClassName,
        )}
      />
      {status === 'loading' ? <p className="sr-only">Carregando mapa…</p> : null}
      {status === 'error' ? (
        <p className="absolute inset-0 flex items-center justify-center bg-background/80 px-4 text-center text-sm text-muted-foreground">
          Não foi possível carregar o mapa. Tente recarregar a página.
        </p>
      ) : null}
    </div>
  )
}
