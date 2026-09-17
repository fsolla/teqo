import { describe, expect, it } from 'vitest'

import {
  getInstitutionCatalogEntry,
  institutionCatalog,
  isInstitutionSlug,
} from '../../src/lib/institutionCatalog'
import {
  resolveInstitutionEntry,
  resolveInstitutionName,
} from '../../src/lib/institutionNameAliases'

// C187: the institutional dossiê resolves its recorte in a catalog and fails
// closed. This pins the v1 seed, the slug/name/alias folds and the ambiguity
// policy (a fold shared by two entries resolves to null, never to a guess).

describe('institutionCatalog', () => {
  it('seeds UFBA, Correios and Enfermagem with kind/sphere/scope/topics', () => {
    expect(institutionCatalog.map((entry) => entry.slug).sort()).toEqual([
      'correios',
      'enfermagem',
      'ufba',
    ])
    for (const entry of institutionCatalog) {
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.topics.length).toBeGreaterThan(0)
    }
    expect(getInstitutionCatalogEntry('ufba')).toMatchObject({
      kind: 'universidade',
      sphere: 'federal',
      scope: 'BA',
    })
    expect(getInstitutionCatalogEntry('enfermagem')).toMatchObject({
      kind: 'categoria_profissional',
      scope: 'nacional',
    })
  })

  it('accepts only catalog slugs', () => {
    expect(isInstitutionSlug('ufba')).toBe(true)
    expect(isInstitutionSlug('correios')).toBe(true)
    expect(isInstitutionSlug('universidade-federal-da-bahia')).toBe(false)
    expect(isInstitutionSlug('ufba-fake')).toBe(false)
  })
})

describe('resolveInstitutionName', () => {
  it('resolves canonical name and aliases accent/case-insensitively', () => {
    expect(resolveInstitutionName('UFBA')).toBe('UFBA')
    expect(resolveInstitutionName('ufba')).toBe('UFBA')
    expect(resolveInstitutionName('Universidade Federal da Bahia')).toBe('UFBA')
    expect(resolveInstitutionName('correios')).toBe('Correios')
    expect(resolveInstitutionName('ECT')).toBe('Correios')
    expect(resolveInstitutionEntry('ABEn-BA')?.slug).toBe('enfermagem')
  })

  it('fails closed on unknown tokens', () => {
    expect(resolveInstitutionName('UFRB')).toBeNull()
    expect(resolveInstitutionName('')).toBeNull()
    expect(resolveInstitutionEntry(null)).toBeNull()
  })
})
