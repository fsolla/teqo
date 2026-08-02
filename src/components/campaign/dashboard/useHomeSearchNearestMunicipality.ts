'use client'

import { useEffect, useRef, useState } from 'react'

import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
} from '@/lib/bahiaGeometries'
import { resolveNearbyMunicipality, type AccessibleMunicipality } from '@/lib/municipalityProximity'
import {
  hasPromptedThisSession,
  markPromptedThisSession,
  readGeolocationPermissionState,
  requestCurrentPosition,
} from '@/utilities/campaignGeolocation'

/**
 * B117 — nearest in-scope município slug for global search suggest.
 * Prompts once per tab session (B14 key) on first focus when permission is not denied.
 * Fail-soft: every other outcome returns `null` with no error UI.
 */
export const useHomeSearchNearestMunicipality = (
  accessible: readonly AccessibleMunicipality[],
  enabled: boolean,
): string | null => {
  const [nearestSlug, setNearestSlug] = useState<string | null>(null)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!enabled || autoStartedRef.current || accessible.length === 0) return
    autoStartedRef.current = true

    let cancelled = false

    const resolveNearest = async () => {
      const loaded = await Promise.all([
        requestCurrentPosition(),
        loadMunicipalityGeometryModule(),
      ]).catch(() => null)

      if (cancelled || !loaded) return

      const [result, geometry] = loaded
      if (!result.ok) return

      const zoneModule = await loadMunicipalityZoneGeometryModule().catch(() => null)

      const resolution = resolveNearbyMunicipality({
        point: result.fix,
        geometry,
        zoneGeometry: zoneModule ?? undefined,
        accessible,
      })

      if (cancelled || resolution.kind !== 'inScope') return

      setNearestSlug(resolution.municipality.slug)
    }

    const start = async () => {
      const permission = await readGeolocationPermissionState()

      if (permission === 'granted') {
        void resolveNearest()
        return
      }

      if (permission !== 'denied' && !hasPromptedThisSession()) {
        markPromptedThisSession()
        void resolveNearest()
      }
    }

    void start()

    return () => {
      cancelled = true
    }
  }, [accessible, enabled])

  return nearestSlug
}
