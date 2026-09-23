// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  filterStateDeputyCards,
  getStateDeputyCard,
  stateDeputyCatalog,
} from '@/lib/stateDeputyCatalog'

type Snapshot = {
  stateDeputyCount: number
  identitySha256: string
  entries: Array<{
    slug: string
    name: string
    ballotNumber: string
    photosSrc: string
    baseSrc: string
  }>
}

const snapshot = JSON.parse(
  readFileSync(new URL('../fixtures/state-deputy-catalog.snapshot.json', import.meta.url), 'utf8'),
) as Snapshot

const publicFile = (src: string) => fileURLToPath(new URL(`../../public${src}`, import.meta.url))

const APPROVED_EXAMPLE_SRC = fileURLToPath(
  new URL(
    '../../docs/plans/cards-estadual-dobradinha-ui-design-assets/modelo-time-de-voce-com-estadual.jpeg',
    import.meta.url,
  ),
)

describe('State-deputy card catalog (S30 — 53 dobradinhas)', () => {
  it('has the 53 delivered deputies with unique slugs, names and ballot numbers', () => {
    expect(stateDeputyCatalog).toHaveLength(53)
    expect(new Set(stateDeputyCatalog.map((card) => card.slug)).size).toBe(53)
    expect(new Set(stateDeputyCatalog.map((card) => card.name)).size).toBe(53)
    expect(new Set(stateDeputyCatalog.map((card) => card.ballotNumber)).size).toBe(53)

    for (const card of stateDeputyCatalog) {
      expect(card.slug, card.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(card.name.trim().length, card.slug).toBeGreaterThan(0)
      expect(card.ballotNumber, card.slug).toMatch(/^\d{5}$/)
    }
  })

  it('keeps both asset paths under /cards/estaduais and derived from the slug', () => {
    for (const card of stateDeputyCatalog) {
      expect(card.photosSrc, card.slug).toBe(`/cards/estaduais/${card.slug}-fotos.webp`)
      expect(card.baseSrc, card.slug).toBe(`/cards/estaduais/${card.slug}-base.webp`)
    }
  })

  it('ships the 106 optimized derivatives committed in public/cards/estaduais', async () => {
    for (const card of stateDeputyCatalog) {
      for (const src of [card.photosSrc, card.baseSrc]) {
        const metadata = await sharp(publicFile(src)).metadata()
        expect(metadata.format, src).toBe('webp')
        expect(`${metadata.width}x${metadata.height}`, src).toBe('1080x1440')
      }

      const base = await sharp(publicFile(card.baseSrc)).metadata()
      expect(base.hasAlpha, card.baseSrc).toBe(true)
    }
  })

  it('uses the exact approved example file for the gallery tile', () => {
    const approved = readFileSync(APPROVED_EXAMPLE_SRC)
    const shipped = readFileSync(publicFile('/cards/modelo-time-de-voce-com-estadual.jpeg'))

    expect(createHash('sha256').update(shipped).digest('hex')).toBe(
      createHash('sha256').update(approved).digest('hex'),
    )
  })

  it('matches the frozen identity snapshot (slug/name/number/assets are the public contract)', () => {
    expect(snapshot.stateDeputyCount).toBe(53)

    const derived = stateDeputyCatalog.map(({ slug, name, ballotNumber, photosSrc, baseSrc }) => ({
      slug,
      name,
      ballotNumber,
      photosSrc,
      baseSrc,
    }))
    expect(derived).toEqual(snapshot.entries)

    const rows = derived
      .map(
        (card) =>
          `P\t${card.slug}\t${card.name}\t${card.ballotNumber}\t${card.photosSrc}\t${card.baseSrc}\n`,
      )
      .join('')
    expect(createHash('sha256').update(rows).digest('hex')).toBe(snapshot.identitySha256)
  })

  it('looks up by slug', () => {
    expect(getStateDeputyCard('julio')?.name).toBe('Julio Pinheiro')
    expect(getStateDeputyCard('ze-raimundo')?.ballotNumber).toBe('13222')
    expect(getStateDeputyCard('julio-pinheiro')).toBeUndefined()
  })

  it('filters by display name ignoring case and accents', () => {
    expect(filterStateDeputyCards('')).toHaveLength(53)
    expect(filterStateDeputyCards('  ')).toHaveLength(53)
    expect(filterStateDeputyCards('JULIO').map((card) => card.slug)).toEqual(['julio'])
    expect(filterStateDeputyCards('josefa').map((card) => card.slug)).toEqual([])
    expect(filterStateDeputyCards('josafa').map((card) => card.slug)).toEqual(['josafa'])
    expect(filterStateDeputyCards('fatima').map((card) => card.slug)).toEqual(['fatima'])
    expect(filterStateDeputyCards('dra.').map((card) => card.slug)).toEqual(['elane', 'fabiola'])
    expect(filterStateDeputyCards('sem-resultado')).toEqual([])
  })

  it('accepts the delivered folder name (slug) as a search keyword', () => {
    expect(filterStateDeputyCards('adriana').map((card) => card.name)).toEqual([
      'Coletivo de Enfermagem',
    ])
    expect(filterStateDeputyCards('ze-raimundo').map((card) => card.slug)).toEqual(['ze-raimundo'])
    expect(filterStateDeputyCards('jamille').map((card) => card.name)).toEqual(['Jamile da Saúde'])
  })
})
