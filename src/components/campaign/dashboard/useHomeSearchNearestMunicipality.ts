'use client'

import type { AccessibleMunicipality } from '@/lib/municipalityProximity'

import { useNearestMunicipalitySlug } from '@/components/campaign/shared/useNearestMunicipalitySlug'

/**
 * B117 / B125 — nearest in-scope município slug for global search suggest.
 * Reuses shared prompt + resolve hook (B14 session key).
 */
export const useHomeSearchNearestMunicipality = (
  accessible: readonly AccessibleMunicipality[],
  enabled: boolean,
): string | null => useNearestMunicipalitySlug(accessible, enabled)
