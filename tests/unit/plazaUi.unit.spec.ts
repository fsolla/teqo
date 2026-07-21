import { describe, expect, it } from 'vitest'

import { shouldUpdatePlazaSearchUrl } from '@/utilities/plazaUi'

describe('shouldUpdatePlazaSearchUrl', () => {
  it('returns false when canonical q matches the current URL q', () => {
    expect(shouldUpdatePlazaSearchUrl('salvador', 'salvador')).toBe(false)
    expect(shouldUpdatePlazaSearchUrl('  salvador  ', 'salvador')).toBe(false)
  })

  it('returns true when q differs or is newly set', () => {
    expect(shouldUpdatePlazaSearchUrl('salv', 'salvador')).toBe(true)
    expect(shouldUpdatePlazaSearchUrl('salvador', undefined)).toBe(true)
    expect(shouldUpdatePlazaSearchUrl('', 'salvador')).toBe(true)
  })
})
