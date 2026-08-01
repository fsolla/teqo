import { afterEach, describe, expect, it } from 'vitest'

import {
  clearLastActedMunicipality,
  getLastActedMunicipalitySlug,
  LAST_ACTED_MUNICIPALITY_STORAGE_KEY,
  recordLastActedMunicipality,
} from '@/lib/campaignLastActedMunicipality'

describe('campaignLastActedMunicipality storage', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('returns null when storage is missing or invalid', () => {
    expect(getLastActedMunicipalitySlug()).toBeNull()
    localStorage.setItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY, 'not-json')
    expect(getLastActedMunicipalitySlug()).toBeNull()
    localStorage.setItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY, JSON.stringify(''))
    expect(getLastActedMunicipalitySlug()).toBeNull()
  })

  it('records and reads the last acted municipality slug', () => {
    recordLastActedMunicipality('itabuna')
    expect(getLastActedMunicipalitySlug()).toBe('itabuna')
    recordLastActedMunicipality('  cairu  ')
    expect(getLastActedMunicipalitySlug()).toBe('cairu')
  })

  it('clears stored slug', () => {
    recordLastActedMunicipality('valenca')
    clearLastActedMunicipality()
    expect(getLastActedMunicipalitySlug()).toBeNull()
    expect(localStorage.getItem(LAST_ACTED_MUNICIPALITY_STORAGE_KEY)).toBeNull()
  })
})
