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
  buildHighlightSet,
  buildLayerStyleContext,
  featureKeyFromProperties,
  keyPropertyForMode,
  resolvePathStyle,
  type BahiaMapFillMode,
  type ChoroplethValues,
  type LayerStyleContext,
} from '@/lib/bahiaMapStyle'
import { cn } from '@/lib/utils'

export type { BahiaMapFillMode, ChoroplethValues }

const BAHIA_BOUNDS: L.LatLngBoundsExpression = [
  [-18.5, -46.8],
  [-8.5, -37.0],
]

export type BahiaMapMode = 'municipality' | 'territory'

export type BahiaMapFeatureInfo = {
  key: string
  name: string
}

type BahiaMapProps = {
  mode: BahiaMapMode
  values: ChoroplethValues
  /** 'diverging': positive = campaign red, negative = blue, zero = white. */
  fillMode?: BahiaMapFillMode
  /** When set, overrides auto max from `values` (e.g. fixed 1 for 0–100% shares). */
  scaleMax?: number
  highlightKeys?: string[]
  selectedKey?: string | null
  onFeatureSelect?: (info: BahiaMapFeatureInfo | null) => void
  onFeatureActivate?: (key: string) => void
  className?: string
  heightClassName?: string
  ariaLabel: string
}

const getPointerType = (event: L.LeafletMouseEvent, fallback = 'mouse') =>
  event.originalEvent instanceof PointerEvent ? event.originalEvent.pointerType : fallback

const fitMapToHighlights = (
  map: L.Map,
  mode: BahiaMapMode,
  highlightSet: Set<string>,
  geometryModule: MunicipalityGeometryModule | TerritoryGeometryModule,
) => {
  if (highlightSet.size === 0) {
    map.fitBounds(BAHIA_BOUNDS, { padding: [16, 16] })
    return
  }

  const highlightedFeatures =
    mode === 'municipality'
      ? [...highlightSet].flatMap((key) => {
          const feature = (geometryModule as MunicipalityGeometryModule).getMunicipalityFeature(key)
          return feature ? [feature] : []
        })
      : [...highlightSet].flatMap((key) => {
          const feature = (geometryModule as TerritoryGeometryModule).getTerritoryFeature(key)
          return feature ? [feature] : []
        })

  if (highlightedFeatures.length === 0) {
    map.fitBounds(BAHIA_BOUNDS, { padding: [16, 16] })
    return
  }

  const highlightBounds = L.geoJSON(highlightedFeatures).getBounds()
  if (highlightBounds.isValid()) {
    map.fitBounds(highlightBounds, { padding: [24, 24], maxZoom: 10 })
  }
}

export const BahiaMap = ({
  mode,
  values,
  fillMode = 'sequential',
  scaleMax,
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
  const geometryModuleRef = useRef<MunicipalityGeometryModule | TerritoryGeometryModule | null>(null)
  const pathByKeyRef = useRef<Map<string, L.Path>>(new Map())
  const styleContextRef = useRef<LayerStyleContext | null>(null)
  const geometryReadyRef = useRef(false)
  const touchPinnedRef = useRef(false)
  const onFeatureSelectRef = useRef(onFeatureSelect)
  const onFeatureActivateRef = useRef(onFeatureActivate)
  const stylePropsRef = useRef({
    values,
    fillMode,
    scaleMax,
    highlightKey: '',
    selectedKey,
  })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const highlightKey = useMemo(() => highlightKeys.slice().sort().join(','), [highlightKeys])

  stylePropsRef.current = {
    values,
    fillMode,
    scaleMax,
    highlightKey,
    selectedKey,
  }

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect
    onFeatureActivateRef.current = onFeatureActivate
  }, [onFeatureActivate, onFeatureSelect])

  const restyleFeature = (key: string) => {
    const context = styleContextRef.current
    const path = pathByKeyRef.current.get(key)
    if (!context || !path) return
    path.setStyle(resolvePathStyle(context, key))
  }

  const restyleAllPaths = () => {
    const context = styleContextRef.current
    if (!context) return

    for (const [key, path] of pathByKeyRef.current) {
      path.setStyle(resolvePathStyle(context, key))
    }
  }

  const setHoveredKey = (nextKey: string | null, bringToFrontLayer?: L.Path) => {
    const context = styleContextRef.current
    if (!context) return

    const previousKey = context.hoveredKey
    if (previousKey === nextKey) return

    if (previousKey) {
      restyleFeature(previousKey)
    }

    context.hoveredKey = nextKey

    if (nextKey) {
      restyleFeature(nextKey)
      ;(bringToFrontLayer ?? pathByKeyRef.current.get(nextKey))?.bringToFront()
      return
    }

    if (context.selectedKey && context.selectedKey !== previousKey) {
      restyleFeature(context.selectedKey)
    }
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
      geometryModuleRef.current = null
      pathByKeyRef.current = new Map()
      styleContextRef.current = null
      geometryReadyRef.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let cancelled = false
    setStatus('loading')
    geometryReadyRef.current = false

    const renderLayer = async () => {
      try {
        const geometryModule =
          mode === 'municipality'
            ? await loadMunicipalityGeometryModule()
            : await loadTerritoryGeometryModule()

        if (cancelled) return

        layerRef.current?.remove()
        pathByKeyRef.current = new Map()

        geometryModuleRef.current = geometryModule

        const keyProperty = keyPropertyForMode(mode)
        const syncMountStyleContext = () => {
          styleContextRef.current = buildLayerStyleContext({
            ...stylePropsRef.current,
            hoveredKey: null,
          })
        }

        syncMountStyleContext()
        const mountContext = styleContextRef.current!

        const layer = L.geoJSON([...geometryModule.features], {
          style: (feature?: Feature) => {
            const properties = feature?.properties as Record<string, string> | undefined
            const key = featureKeyFromProperties(properties, keyProperty)
            const context = styleContextRef.current ?? mountContext
            return resolvePathStyle(context, key ?? '')
          },
          onEachFeature: (feature, featureLayer) => {
            if (!(featureLayer instanceof L.Path)) return

            const properties = feature.properties as Record<string, string> | undefined
            const key = featureKeyFromProperties(properties, keyProperty)
            if (!key) return

            const name = properties?.name ?? key
            pathByKeyRef.current.set(key, featureLayer)

            featureLayer.on('mouseover', (event) => {
              const pointerType = getPointerType(event)
              if (pointerType === 'mouse') {
                touchPinnedRef.current = false
              } else if (touchPinnedRef.current) {
                return
              }

              if (styleContextRef.current?.hoveredKey === key) return

              setHoveredKey(key, featureLayer)
              onFeatureSelectRef.current?.({ key, name })
            })

            featureLayer.on('mouseout', () => {
              if (touchPinnedRef.current) return
              setHoveredKey(null)
              onFeatureSelectRef.current?.(null)
            })

            featureLayer.on('click', (event) => {
              touchPinnedRef.current = getPointerType(event, 'mouse') === 'touch'

              setHoveredKey(key, featureLayer)
              onFeatureActivateRef.current?.(key)
              onFeatureSelectRef.current?.({ key, name })
            })
          },
        })

        layer.addTo(map)
        layerRef.current = layer
        map.invalidateSize()

        syncMountStyleContext()
        restyleAllPaths()

        fitMapToHighlights(
          map,
          mode,
          styleContextRef.current!.highlightSet,
          geometryModule,
        )

        geometryReadyRef.current = true
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
      pathByKeyRef.current = new Map()
      geometryModuleRef.current = null
      geometryReadyRef.current = false
    }
    // Geometry layer rebuilds only when `mode` changes; metric/hover updates use separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional [mode]-only mount
  }, [mode])

  useEffect(() => {
    if (!geometryReadyRef.current) return

    const map = mapRef.current
    const geometryModule = geometryModuleRef.current
    if (!map || !geometryModule || !layerRef.current) return

    fitMapToHighlights(map, mode, buildHighlightSet(highlightKey), geometryModule)
  }, [highlightKey, mode])

  useEffect(() => {
    const previousContext = styleContextRef.current
    const context = buildLayerStyleContext({
      values,
      fillMode,
      scaleMax,
      highlightKey,
      selectedKey,
      hoveredKey: previousContext?.hoveredKey ?? null,
    })
    styleContextRef.current = context

    if (pathByKeyRef.current.size === 0) return
    restyleAllPaths()
    // `selectedKey` changes use the dedicated 2-path effect below (not full O(n) restyle).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedKey excluded on purpose
  }, [values, fillMode, scaleMax, highlightKey, mode])

  useEffect(() => {
    const context = styleContextRef.current
    if (!context || pathByKeyRef.current.size === 0) {
      if (context) context.selectedKey = selectedKey
      return
    }
    if (context.selectedKey === selectedKey) return

    const previousSelected = context.selectedKey
    context.selectedKey = selectedKey

    if (context.hoveredKey) return

    if (previousSelected) {
      restyleFeature(previousSelected)
    }
    if (selectedKey) {
      restyleFeature(selectedKey)
    }
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
