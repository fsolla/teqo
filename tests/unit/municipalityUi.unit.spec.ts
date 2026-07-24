import { describe, expect, it } from 'vitest'

import { shouldUpdateMunicipalitySearchUrl } from '@/utilities/municipalityUi'

describe('shouldUpdateMunicipalitySearchUrl', () => {
  it('returns false when canonical q matches the current URL q', () => {
    expect(shouldUpdateMunicipalitySearchUrl('salvador', 'salvador')).toBe(false)
    expect(shouldUpdateMunicipalitySearchUrl('  salvador  ', 'salvador')).toBe(false)
  })

  it('returns true when q differs or is newly set', () => {
    expect(shouldUpdateMunicipalitySearchUrl('salv', 'salvador')).toBe(true)
    expect(shouldUpdateMunicipalitySearchUrl('salvador', undefined)).toBe(true)
    expect(shouldUpdateMunicipalitySearchUrl('', 'salvador')).toBe(true)
  })
})
