'use client'

import type { Feature } from 'geojson'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'

import 'leaflet/dist/leaflet.css'

import { Spinner } from '@/components/ui/Spinner'
import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
  loadTerritoryGeometryModule,
} from '@/lib/bahiaGeometries'
import type { BahiaMeshFeature } from '@/lib/bahiaGeometriesTypes'
import {
  bubbleRadius,
  buildHighlightSet,
  buildLayerStyleContext,
  canonicalMapKeysKey,
  featureMapKey,
  resolvePathStyle,
  type BahiaMapFillMode,
  type ChoroplethFills,
  type ChoroplethValues,
  type LayerStyleContext,
} from '@/lib/bahiaMapStyle'
import { choroplethMaxValue } from '@/lib/choroplethColorScale'
import { cn } from '@/lib/utils'

const BAHIA_BOUNDS: L.LatLngBoundsExpression = [
  [-18.5, -46.8],
  [-8.5, -37.0],
]

/** Shared by state-level `fitBounds` and `getBoundsZoom` so minZoom matches the initial fit. */
const BAHIA_FIT_PADDING = L.point(16, 16)

/**
 * Bubbles get their own pane above the polygons: hovering a município calls
 * `bringToFront()` on its path, which in a shared pane would raise the polygon
 * over the very bubble it describes.
 */
const BUBBLE_PANE = 'municipality-bubbles'

/**
 * Clamp zoom-out to the zoom where the whole state still fills the container.
 * Temporarily drops the floor before measuring: `getBoundsZoom` clamps to the
 * current `minZoom`, so without that the floor can only rise on shrink and never
 * fall on enlarge. Restores the previous floor if the measure is non-finite
 * (0×0 container before layout / hidden tab).
 */
const applyBahiaMinZoom = (map: L.Map) => {
  const previousMinZoom = map.getMinZoom()
  map.setMinZoom(0)
  const zoom = map.getBoundsZoom(BAHIA_BOUNDS, false, BAHIA_FIT_PADDING)
  if (!Number.isFinite(zoom)) {
    map.setMinZoom(previousMinZoom)
    return
  }
  map.setMinZoom(zoom)
}

/**
 * `territory` has no caller today — B21 moved the Identity Territories to their
 * own page and `MunicipalityMapPanel` hardcodes `municipality`. It is kept
 * because E12 registered the TI map mode as a trigger, not because something
 * still reads it; `bahiaTerritoryGeometries` and its ~15 KB artifact are alive
 * only through that decision and the int spec.
 */
export type BahiaMapMode = 'municipality' | 'territory'

/**
 * The municipality layer is two meshes: the 417 municípios plus the 19 Salvador
 * zone polygons on top (insertion order is z-order in the SVG). The zone city's
 * own polygon stays underneath as a BASE — no value, no pointer — so a sliver of
 * disagreement between two independently simplified meshes cannot punch a hole
 * in the state's outline.
 */
const loadLayerFeatures = async (
  mode: BahiaMapMode,
): Promise<{ features: BahiaMeshFeature[]; baseKeys: Set<string> }> => {
  if (mode === 'territory') {
    const { features } = await loadTerritoryGeometryModule()
    return { features: [...features], baseKeys: new Set() }
  }

  const [municipalities, zones] = await Promise.all([
    loadMunicipalityGeometryModule(),
    // B8+ F3 — the state mesh is the map; the zone mesh is a detail on top of it.
    // If it fails to arrive, Salvador falls back to the base polygon it already
    // has underneath: drawn, but with no value and no pointer, since the bundle
    // is keyed by zone slug and the city code is not a scoped key. Every other
    // município keeps working instead of the whole panel erroring out. A network
    // ChunkLoadError is the expected failure and needs no report; a decode error
    // or a renamed topology object is a bug, so the reason is logged either way.
    loadMunicipalityZoneGeometryModule().catch((error: unknown) => {
      console.error('[map] malha das zonas indisponível; Bahia sem as ZE de Salvador', error)
      return null
    }),
  ])

  const zoneFeatures = zones?.features ?? []

  return {
    features: [...municipalities.features, ...zoneFeatures],
    baseKeys: new Set(zoneFeatures.map((zone) => zone.properties.ibgeCode)),
  }
}

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
  /**
   * Discrete class fills by feature key (B13). When provided they replace the
   * continuous ramp entirely, and a key that is absent renders as "no data".
   * Must be referentially stable across renders, or every render repaints
   * every path.
   */
  fillByKey?: ChoroplethFills
  /**
   * B13 — proportional symbols: feature key → magnitude, drawn as a circle at
   * the feature's centre with radius ∝ √value. Absent keys get no bubble.
   */
  bubbleValues?: ChoroplethValues
  /** Bubble fill by feature key; keys without one fall back to the neutral fill. */
  bubbleFillByKey?: ChoroplethFills
  highlightKeys?: string[]
  /** Fit viewport to these keys without highlighting them. */
  fitToKeys?: string[]
  /** When non-empty, only these keys receive hover/click. */
  interactiveKeys?: string[]
  selectedKey?: string | null
  onFeatureSelect?: (info: BahiaMapFeatureInfo | null) => void
  onFeatureActivate?: (key: string) => void
  className?: string
  heightClassName?: string
  ariaLabel: string
}

const getPointerType = (event: L.LeafletMouseEvent, fallback = 'mouse') =>
  event.originalEvent instanceof PointerEvent ? event.originalEvent.pointerType : fallback

/**
 * Fits from the drawn paths rather than the geometry modules: since B8 F2 a
 * municipality layer is assembled from two meshes, and the paths are the one
 * index that already knows which key came from which.
 */
const fitMapToHighlights = (
  map: L.Map,
  highlightSet: Set<string>,
  pathByKey: Map<string, L.Path>,
) => {
  const highlightBounds = L.latLngBounds([])
  for (const key of highlightSet) {
    const path = pathByKey.get(key)
    if (path instanceof L.Polygon) highlightBounds.extend(path.getBounds())
  }

  if (!highlightBounds.isValid()) {
    map.fitBounds(BAHIA_BOUNDS, { padding: BAHIA_FIT_PADDING })
    return
  }

  map.fitBounds(highlightBounds, { padding: [24, 24], maxZoom: 10 })
}

export const BahiaMap = ({
  mode,
  values,
  fillMode = 'sequential',
  scaleMax,
  fillByKey,
  bubbleValues,
  bubbleFillByKey,
  highlightKeys = [],
  fitToKeys = [],
  interactiveKeys = [],
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
  const pathByKeyRef = useRef<Map<string, L.Path>>(new Map())
  const styleContextRef = useRef<LayerStyleContext | null>(null)
  const geometryReadyRef = useRef(false)
  const touchPinnedRef = useRef(false)
  const onFeatureSelectRef = useRef(onFeatureSelect)
  const onFeatureActivateRef = useRef(onFeatureActivate)
  const interactiveSetRef = useRef<Set<string> | null>(null)
  const lastFittedViewportKeyRef = useRef<string | null>(null)
  const stylePropsRef = useRef({
    values,
    fillMode,
    scaleMax,
    fillByKey,
    highlightKey: '',
    selectedKey,
  })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const highlightKey = useMemo(() => canonicalMapKeysKey(highlightKeys), [highlightKeys])
  const fitKey = useMemo(() => canonicalMapKeysKey(fitToKeys), [fitToKeys])
  const interactiveKey = useMemo(() => canonicalMapKeysKey(interactiveKeys), [interactiveKeys])
  const viewportKey = useMemo(() => fitKey || highlightKey, [fitKey, highlightKey])
  const interactiveSet = useMemo(
    () => (interactiveKey ? buildHighlightSet(interactiveKey) : null),
    [interactiveKey],
  )

  interactiveSetRef.current = interactiveSet

  stylePropsRef.current = {
    values,
    fillMode,
    scaleMax,
    fillByKey,
    highlightKey,
    selectedKey,
  }

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect
    onFeatureActivateRef.current = onFeatureActivate
  }, [onFeatureActivate, onFeatureSelect])

  const isKeyInteractive = (key: string) => {
    const set = interactiveSetRef.current
    return set === null || set.has(key)
  }

  const resolvePathStyleForFeature = (context: LayerStyleContext, key: string) => ({
    ...resolvePathStyle(context, key),
    interactive: isKeyInteractive(key),
  })

  const restyleFeature = (key: string) => {
    const context = styleContextRef.current
    const path = pathByKeyRef.current.get(key)
    if (!context || !path) return
    path.setStyle(resolvePathStyleForFeature(context, key))
  }

  const restyleAllPaths = () => {
    const context = styleContextRef.current
    if (!context) return

    for (const [key, path] of pathByKeyRef.current) {
      path.setStyle(resolvePathStyleForFeature(context, key))
    }
  }

  const setHoveredKey = (
    nextKey: string | null,
    bringToFrontLayer?: L.Path,
    clearSelection = false,
  ) => {
    const context = styleContextRef.current
    if (!context) return

    const previousKey = context.hoveredKey
    if (previousKey === nextKey) return

    context.hoveredKey = nextKey

    if (clearSelection && previousKey && context.selectedKey === previousKey) {
      context.selectedKey = null
    }

    if (previousKey) {
      restyleFeature(previousKey)
    }

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
      // Soft pad so viscosity:1 does not clip the edge município on drag.
      maxBounds: L.latLngBounds(BAHIA_BOUNDS).pad(0.1),
      maxBoundsViscosity: 1,
    })
    map.fitBounds(BAHIA_BOUNDS, { padding: BAHIA_FIT_PADDING })
    applyBahiaMinZoom(map)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    mapRef.current = map

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize()
            applyBahiaMinZoom(map)
          })
        : null
    resizeObserver?.observe(container)

    return () => {
      resizeObserver?.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
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
    lastFittedViewportKeyRef.current = null

    const renderLayer = async () => {
      try {
        const { features, baseKeys } = await loadLayerFeatures(mode)

        if (cancelled) return

        layerRef.current?.remove()
        pathByKeyRef.current = new Map()

        const syncMountStyleContext = () => {
          styleContextRef.current = buildLayerStyleContext({
            ...stylePropsRef.current,
            hoveredKey: null,
          })
        }

        syncMountStyleContext()
        const mountContext = styleContextRef.current!

        /**
         * The key this feature answers for, or `undefined` when it is a base
         * polygon: those carry no value, take no pointer, and must not answer
         * for a key the data has moved off of.
         */
        const paintedKey = (properties: Feature['properties'] | undefined) => {
          const key = featureMapKey(properties)
          return key && !baseKeys.has(key) ? key : undefined
        }

        const layer = L.geoJSON(features, {
          style: (feature?: Feature) => {
            const context = styleContextRef.current ?? mountContext
            const key = paintedKey(feature?.properties)
            return key
              ? resolvePathStyleForFeature(context, key)
              : { ...resolvePathStyle(context, ''), interactive: false }
          },
          onEachFeature: (feature, featureLayer) => {
            if (!(featureLayer instanceof L.Path)) return

            const key = paintedKey(feature.properties)
            if (!key) return

            const name =
              typeof feature.properties?.name === 'string' ? feature.properties.name : key
            pathByKeyRef.current.set(key, featureLayer)

            featureLayer.on('mouseover', (event) => {
              if (!isKeyInteractive(key)) return

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
              if (!isKeyInteractive(key)) return

              setHoveredKey(null, undefined, true)
              onFeatureSelectRef.current?.(null)
            })

            featureLayer.on('click', (event) => {
              if (!isKeyInteractive(key)) return

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
        // Layout may have been 0×0 on mount — re-apply after size is known.
        applyBahiaMinZoom(map)

        syncMountStyleContext()
        restyleAllPaths()

        const fitIdentity = `${mode}:${viewportKey}`
        fitMapToHighlights(map, buildHighlightSet(viewportKey), pathByKeyRef.current)
        lastFittedViewportKeyRef.current = fitIdentity

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
      geometryReadyRef.current = false
    }
    // Geometry layer rebuilds only when `mode` changes; metric/hover updates use separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional [mode]-only mount
  }, [mode])

  useEffect(() => {
    if (!geometryReadyRef.current) return

    const fitIdentity = `${mode}:${viewportKey}`
    if (lastFittedViewportKeyRef.current === fitIdentity) return

    const map = mapRef.current
    if (!map || !layerRef.current) return

    fitMapToHighlights(map, buildHighlightSet(viewportKey), pathByKeyRef.current)
    lastFittedViewportKeyRef.current = fitIdentity
  }, [viewportKey, mode])

  useEffect(() => {
    if (!interactiveKey || pathByKeyRef.current.size === 0) return
    restyleAllPaths()
    // Restyle helpers only read refs and are recreated per render — depending
    // on them would re-run this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interactiveKey-only restyle
  }, [interactiveKey])

  useEffect(() => {
    const previousContext = styleContextRef.current
    const context = buildLayerStyleContext({
      values,
      fillMode,
      scaleMax,
      fillByKey,
      highlightKey,
      selectedKey,
      hoveredKey: previousContext?.hoveredKey ?? null,
    })
    styleContextRef.current = context

    if (pathByKeyRef.current.size === 0) return
    restyleAllPaths()
    // `selectedKey` changes use the dedicated 2-path effect below (not full O(n) restyle).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedKey excluded on purpose
  }, [values, fillMode, scaleMax, fillByKey, highlightKey, mode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !bubbleValues || status !== 'ready') return

    const maxValue = choroplethMaxValue(bubbleValues)
    if (maxValue <= 0) return

    if (!map.getPane(BUBBLE_PANE)) {
      const pane = map.createPane(BUBBLE_PANE)
      pane.style.zIndex = '450'
      pane.style.pointerEvents = 'none'
    }

    // Smallest first so the big prizes end up drawn on top of the crowd
    // instead of being covered by whichever key the object happened to list last.
    const ordered = Object.entries(bubbleValues)
      .filter(([, value]) => value > 0)
      .sort(([, left], [, right]) => left - right)

    const markers: L.CircleMarker[] = []
    for (const [key, value] of ordered) {
      const path = pathByKeyRef.current.get(key)
      const fillColor = bubbleFillByKey?.[key]
      if (!(path instanceof L.Polygon) || !fillColor) continue

      markers.push(
        // Polygon centroid, not the bounding box's centre: a concave or
        // L-shaped município would put a box centre outside its own outline.
        L.circleMarker(path.getCenter(), {
          pane: BUBBLE_PANE,
          radius: bubbleRadius(value, maxValue),
          fillColor,
          fillOpacity: 0.8,
          color: '#ffffff',
          weight: 0.75,
          // Deliberately not interactive: every bubble sits on top of its own
          // município, so letting the pointer fall through keeps ONE hover
          // target and one readout instead of two stacked ones.
          interactive: false,
        }),
      )
    }

    const group = L.layerGroup(markers).addTo(map)

    return () => {
      group.remove()
    }
    // `mode` rebuilds the geometry layer this reads centroids from, so the
    // markers must be rebuilt with it or they would sit at stale positions.
  }, [bubbleValues, bubbleFillByKey, status, mode])

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
    // Restyle helpers only read refs and are recreated per render — depending
    // on them would re-run this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedKey-only O(2) restyle
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
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center" role="status">
          <span className="flex items-center gap-2 rounded-md bg-background/85 px-3 py-2 text-sm text-muted-foreground shadow-sm">
            <Spinner aria-hidden="true" />
            Carregando mapa…
          </span>
        </div>
      ) : null}
      {status === 'error' ? (
        <p className="absolute inset-0 flex items-center justify-center bg-background/80 px-4 text-center text-sm text-muted-foreground">
          Não foi possível carregar o mapa. Tente recarregar a página.
        </p>
      ) : null}
    </div>
  )
}
