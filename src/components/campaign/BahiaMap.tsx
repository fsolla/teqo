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

type BahiaMapProps = {
  mode: BahiaMapMode
  values: ChoroplethValues
  /** 'diverging': positive = campaign red, negative = blue, zero = white. */
  fillMode?: BahiaMapFillMode
  highlightKeys?: string[]
  className?: string
  heightClassName?: string
  ariaLabel: string
}

export const BahiaMap = ({
  mode,
  values,
  fillMode = 'sequential',
  highlightKeys = [],
  className,
  heightClassName = 'h-[320px]',
  ariaLabel,
}: BahiaMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const highlightKey = useMemo(() => highlightKeys.slice().sort().join(','), [highlightKeys])

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

        const layer = L.geoJSON([...geometryModule.features], {
          style: (feature?: Feature) => {
            const properties = feature?.properties as Record<string, string> | undefined
            const key = featureKey(properties, keyProperty)
            const metric = key ? (values[key] ?? 0) : 0
            const highlighted = key ? highlightSet.has(key) : false

            return {
              weight: highlighted ? 2.5 : 1,
              color: highlighted ? '#c51414' : '#a8a29e',
              fillColor:
                fillMode === 'diverging'
                  ? divergingFillColor(metric, max)
                  : choroplethFillColor(metric, max),
              fillOpacity: highlighted ? 0.92 : metric !== 0 ? 0.78 : 0.35,
            }
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
    }
  }, [fillMode, highlightKey, mode, values])

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={containerRef}
        role="img"
        aria-label={ariaLabel}
        aria-busy={status === 'loading'}
        className={cn(
          'w-full overflow-hidden rounded-lg border border-border bg-muted/30',
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
