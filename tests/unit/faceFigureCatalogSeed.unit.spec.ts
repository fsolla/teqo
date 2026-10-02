// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { stateDeputyCatalog } from '@/lib/stateDeputyCatalog'
import {
  FACE_FIGURE_NAMED_ENTRIES,
  faceFigureCatalogSeed,
} from '../../scripts/lib/faceFigureCatalogSeed.mjs'

// C244 — the initial catalog of the "Pessoa pública" facet: the six named
// figures plus the S30 roster, deduped by the public slug that the `?pessoa`
// URL uses.

describe('faceFigureCatalogSeed', () => {
  const entries = faceFigureCatalogSeed()

  it('contains the named figures of the owner decision with their display names', () => {
    const bySlug = new Map(entries.map((entry) => [entry.slug, entry]))

    expect(bySlug.get('jorge-solla')?.name).toBe('Jorge Solla')
    expect(bySlug.get('lula')).toMatchObject({
      name: 'Lula',
      fullName: 'Luiz Inácio Lula da Silva',
    })
    expect(bySlug.get('jeronimo')).toMatchObject({ name: 'Jerônimo' })
    expect(bySlug.get('geraldinho')).toMatchObject({ name: 'Geraldinho' })
    expect(bySlug.get('wagner')).toMatchObject({ name: 'Wagner' })
    expect(bySlug.get('julio-pinheiro')).toMatchObject({ name: 'Júlio Pinheiro' })

    // Júlio Pinheiro is both a named figure and a roster entry: one dedupe.
    expect(entries.length).toBe(FACE_FIGURE_NAMED_ENTRIES.length + stateDeputyCatalog.length - 1)
  })

  it('has unique, URL-safe slugs and non-empty names', () => {
    const slugs = entries.map((entry) => entry.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const entry of entries) {
      expect(entry.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(entry.name.trim().length).toBeGreaterThan(0)
    }
  })
})
