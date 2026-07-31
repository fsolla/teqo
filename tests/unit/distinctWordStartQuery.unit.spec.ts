import { describe, expect, it } from 'vitest'

import { distinctWordStartQuery } from '../helpers/distinctWordStartQuery'

describe('distinctWordStartQuery', () => {
  it('returns a word that matches only the target name', () => {
    expect(distinctWordStartQuery('Nova Canaã', 'Nova Soure')).toBe('Canaã')
    expect(distinctWordStartQuery('Nova Soure', 'Nova Canaã')).toBe('Soure')
  })

  it('falls back to the first word when names do not share a prefix token', () => {
    expect(distinctWordStartQuery('Cairu', 'Feira de Santana')).toBe('Cairu')
  })
})
