import { describe, expect, it } from 'vitest'

import {
  getNucleusIbgeVoterProfile,
  IBGE_VOTER_PROFILE_LABEL,
} from '@/utilities/nucleusIbgeVoterProfile'

describe('getNucleusIbgeVoterProfile', () => {
  it('returns a profile for a single municipality', () => {
    const result = getNucleusIbgeVoterProfile({ cities: ['Salvador'], regions: [] })
    expect(result.status).toBe('available')
    if (result.status !== 'available') return

    expect(result.profile.label).toBe(IBGE_VOTER_PROFILE_LABEL)
    expect(result.profile.notes).toContain('habitantes')
    expect(result.profile.ageRange).toContain('0 a 17 anos')
    expect(result.profile.localTraits).toContain('Predominam moradores')
    expect(result.profile.notes).toContain('município')
  })

  it('weights multiple municipalities by population', () => {
    const combined = getNucleusIbgeVoterProfile({
      cities: ['Salvador', 'Abaíra'],
      regions: [],
    })

    expect(combined.status).toBe('available')
    if (combined.status !== 'available') return

    expect(combined.profile.notes).toContain('2 municípios')
  })

  it('resolves cities from identity territories when cities are empty', () => {
    const result = getNucleusIbgeVoterProfile({
      cities: [],
      regions: ['Metropolitano de Salvador'],
    })

    expect(result.status).toBe('available')
  })

  it('returns semPerfil when geography is missing', () => {
    expect(getNucleusIbgeVoterProfile({ cities: [], regions: [] })).toEqual({
      status: 'semPerfil',
    })
  })

  it('returns semPerfil for unknown municipalities', () => {
    expect(
      getNucleusIbgeVoterProfile({ cities: ['Município inexistente'], regions: [] }),
    ).toEqual({ status: 'semPerfil' })
  })
})
