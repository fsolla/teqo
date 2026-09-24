// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CONTENT_PIECE_PUBLIC_FIGURES_MAX,
  CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH,
} from '@/lib/contentPiece'
import {
  PUBLIC_FIGURE_PERSONALITIES,
  filterPublicFigures,
  normalizeContentPiecePublicFigures,
  publicFigureCatalog,
  resolvePublicFigureName,
} from '@/lib/publicFigureCatalog'
import { stateDeputyCatalog } from '@/lib/stateDeputyCatalog'

describe('public figure catalog (S37)', () => {
  it('derives every dobradinha from the S30 roster without copying the names', () => {
    expect(PUBLIC_FIGURE_PERSONALITIES).toEqual([])
    expect(publicFigureCatalog).toHaveLength(stateDeputyCatalog.length)
    expect(
      publicFigureCatalog.filter((entry) => entry.kind === 'dobradinha').map((entry) => entry.name),
    ).toEqual(stateDeputyCatalog.map((deputy) => deputy.name))

    const elaine = publicFigureCatalog.find((entry) => entry.name === 'Dra. Elaine')
    expect(elaine).toEqual({ slug: 'estadual-elane', name: 'Dra. Elaine', kind: 'dobradinha' })
  })

  it('resolves a typed name or slug to the canonical spelling, case/accent-insensitive', () => {
    expect(resolvePublicFigureName('Dra. Elaine')).toBe('Dra. Elaine')
    expect(resolvePublicFigureName('dra elaine')).toBe('Dra. Elaine')
    expect(resolvePublicFigureName('  DRÁ  ELAINE ')).toBe('Dra. Elaine')
    expect(resolvePublicFigureName('estadual-elane')).toBe('Dra. Elaine')
    // Unknown names stay free text (the picker's "use this text" path).
    expect(resolvePublicFigureName('Personalidade Sem Catálogo')).toBeNull()
    expect(resolvePublicFigureName('')).toBeNull()
  })

  it('filters by display name or slug, keeping the whole roster on an empty query', () => {
    expect(filterPublicFigures('')).toHaveLength(stateDeputyCatalog.length)
    expect(filterPublicFigures('elaine').map((entry) => entry.name)).toEqual(['Dra. Elaine'])
    expect(filterPublicFigures('coletivo').map((entry) => entry.slug)).toEqual(['estadual-adriana'])
    expect(filterPublicFigures('ninguém')).toEqual([])
  })

  it('canonicalizes, dedupes and bounds the persisted figure list', () => {
    expect(
      normalizeContentPiecePublicFigures([
        ' dra elaine ',
        'Dra. Elaine',
        'Personalidade Exemplo',
        'personalidade exemplo',
        '',
        '   ',
      ]),
    ).toEqual(['Dra. Elaine', 'Personalidade Exemplo'])

    expect(
      normalizeContentPiecePublicFigures(['x'.repeat(CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH + 1)]),
    ).toEqual([])

    const many = Array.from({ length: CONTENT_PIECE_PUBLIC_FIGURES_MAX + 5 }, (_, index) =>
      String(`Pessoa ${index + 1}`),
    )
    expect(normalizeContentPiecePublicFigures(many)).toHaveLength(CONTENT_PIECE_PUBLIC_FIGURES_MAX)
  })
})
