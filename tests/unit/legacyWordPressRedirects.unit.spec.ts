import { describe, expect, it } from 'vitest'

import { legacyWordPressPostRedirects } from '../../scripts/lib/legacyWordPressRedirects.mjs'

const SOURCE_PATTERN = /^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+$/
const DESTINATION_PATTERN = /^\/noticia\/[a-z-]+\/[a-z0-9-]+$/

describe('legacy WordPress post redirects (OPS131)', () => {
  it('covers the 43 published posts from the WordPress archive', () => {
    expect(legacyWordPressPostRedirects).toHaveLength(43)
  })

  it('uses the WordPress date permalink shape and the canonical Teqo article path', () => {
    for (const { source, destination } of legacyWordPressPostRedirects) {
      expect(source).toMatch(SOURCE_PATTERN)
      expect(destination).toMatch(DESTINATION_PATTERN)
      expect(destination.split('/').at(-1)).toBe(source.split('/').at(-1))
    }
  })

  it('has no duplicate source or destination', () => {
    const sources = legacyWordPressPostRedirects.map((entry) => entry.source)
    const destinations = legacyWordPressPostRedirects.map((entry) => entry.destination)

    expect(new Set(sources).size).toBe(sources.length)
    expect(new Set(destinations).size).toBe(destinations.length)
  })

  it('pins the oldest and newest archived posts', () => {
    const bySource = new Map(
      legacyWordPressPostRedirects.map((entry) => [entry.source, entry.destination]),
    )

    expect(
      bySource.get('/2024/07/22/apresentacao-do-plano-de-restauracao-arquitetonica-da-famed-ufba'),
    ).toBe('/noticia/educacao/apresentacao-do-plano-de-restauracao-arquitetonica-da-famed-ufba')
    expect(
      bySource.get(
        '/2026/08/17/bruno-reis-foi-covarde-detonou-solla-ao-rebater-o-prefeito-sobre-saude-de-salvador',
      ),
    ).toBe(
      '/noticia/politica/bruno-reis-foi-covarde-detonou-solla-ao-rebater-o-prefeito-sobre-saude-de-salvador',
    )
  })
})
