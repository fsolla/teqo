'use client'

import { useEffect, useRef, useState } from 'react'

import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
} from '@/lib/bahiaGeometries'
import {
  resolveNearbyMunicipality,
  type AccessibleMunicipality,
} from '@/lib/municipalityProximity'
import type { WizardGeoMunicipalitySuggestion } from '@/lib/wizardMunicipalitySuggestMerge'
import {
  readGeolocationPermissionState,
  requestCurrentPosition,
} from '@/utilities/campaignGeolocation'

/**
 * B94 — resolves the nearest in-scope município for the wizard idle state.
 * Only runs when geolocation permission is already `granted` (prompt lives on the Quadro).
 * Fail-soft: every other outcome returns `null` with no error UI.
 */
export const useWizardNearestMunicipality = (
  accessible: readonly AccessibleMunicipality[],
  enabled: boolean,
): WizardGeoMunicipalitySuggestion | null => {
  const [geo, setGeo] = useState<WizardGeoMunicipalitySuggestion | null>(null)
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (!enabled || autoStartedRef.current || accessible.length === 0) return
    autoStartedRef.current = true

    let cancelled = false

    const resolve = async () => {
      const permission = await readGeolocationPermissionState()
      if (permission !== 'granted') return

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

      setGeo({
        slug: resolution.municipality.slug,
        name: resolution.municipality.name,
        distanceKm: resolution.match === 'nearestZone' ? resolution.distanceKm : undefined,
      })
    }

    void resolve()

    return () => {
      cancelled = true
    }
  }, [accessible, enabled])

  return geo
}
