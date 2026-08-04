import { describe, expect, it } from 'vitest'

import { parseStateDeputyNameParty } from '@/lib/stateDeputyNameParty'

describe('parseStateDeputyNameParty (B157)', () => {
  it('returns the trimmed name with no party when there are no parens', () => {
    expect(parseStateDeputyNameParty('Cicrano')).toEqual({ name: 'Cicrano', party: null })
    expect(parseStateDeputyNameParty('  Cicrano de Tal  ')).toEqual({
      name: 'Cicrano de Tal',
      party: null,
    })
  })

  it('extracts a trailing parenthesized group as the party', () => {
    expect(parseStateDeputyNameParty('Cicrano (PCdoB)')).toEqual({
      name: 'Cicrano',
      party: 'PCdoB',
    })
    expect(parseStateDeputyNameParty('Fulano (PT) ')).toEqual({ name: 'Fulano', party: 'PT' })
    expect(parseStateDeputyNameParty('Fulana da Silva (PSB)')).toEqual({
      name: 'Fulana da Silva',
      party: 'PSB',
    })
  })

  it('keeps parens that are not a trailing group as part of the name', () => {
    // The doc's rule is ONE group at the very end; anything else stays in the name.
    expect(parseStateDeputyNameParty('Fulano (PT) da Silva')).toEqual({
      name: 'Fulano (PT) da Silva',
      party: null,
    })
  })

  it('takes the LAST group when the text ends in several', () => {
    expect(parseStateDeputyNameParty('Fulano (PT) (PSB)')).toEqual({
      name: 'Fulano (PT)',
      party: 'PSB',
    })
  })

  it('refuses a whole-string group with an empty name', () => {
    // "(PT)" must not mint a deputy named "(PT)": the schema rejects the empty name.
    expect(parseStateDeputyNameParty('(PT)')).toEqual({ name: '', party: 'PT' })
  })

  it('trims the party', () => {
    expect(parseStateDeputyNameParty('Cicrano ( PCdoB )')).toEqual({
      name: 'Cicrano',
      party: 'PCdoB',
    })
  })
})
