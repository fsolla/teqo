import { describe, expect, it } from 'vitest'

import {
  ARCHIVE_PHOTO_CAPTION_MAX_LENGTH,
  archivePhotoSearchText,
  archivePhotoTakenOn,
  archivePhotoThemesFrom,
  buildArchivePhotoCatalogWrite,
  changedArchivePhotoCuratedFields,
  matchPublicFigureMentions,
  parseArchiveVisionOutput,
  resolveArchivePhotoScene,
} from '@/lib/archivePhotoCatalog'
import { publicFigureCatalog } from '@/lib/publicFigureCatalog'

// C232 — the pure rules of the archive pre-cataloguing: closed vocabularies
// (scene/themes/curated fields), the fail-closed vision parser, the
// deterministic text matches and the merge that never overwrites curation.
// No provider, network or Payload here.

const suggestion = (
  overrides: Partial<Parameters<typeof buildArchivePhotoCatalogWrite>[0]['suggestion']> = {},
) => ({
  caption: null as string | null,
  description: null as string | null,
  scene: null as ReturnType<typeof resolveArchivePhotoScene>,
  visibleText: null as string | null,
  hasPeople: null as boolean | null,
  themes: [] as ReturnType<typeof archivePhotoThemesFrom>,
  ...overrides,
})

const writeInput = (
  overrides: Partial<Parameters<typeof buildArchivePhotoCatalogWrite>[0]> = {},
): Parameters<typeof buildArchivePhotoCatalogWrite>[0] => ({
  suggestion: suggestion(),
  municipalityId: null,
  mentionedPeople: [],
  gazetteerThemes: [],
  curatedFields: [],
  currentCatalog: null,
  currentAlt: null,
  catalogedAt: '2026-09-26T12:00:00.000Z',
  ...overrides,
})

describe('resolveArchivePhotoScene (C232)', () => {
  it('resolves value and pt-BR label, accent/case insensitive', () => {
    expect(resolveArchivePhotoScene('plenaria')).toBe('plenaria')
    expect(resolveArchivePhotoScene('Plenária')).toBe('plenaria')
    expect(resolveArchivePhotoScene('SEGURANCA')).toBeNull()
    expect(resolveArchivePhotoScene('Audiência')).toBe('audiencia')
    expect(resolveArchivePhotoScene('outro')).toBe('outro')
  })

  it('is fail-closed for unknown or non-string tokens', () => {
    expect(resolveArchivePhotoScene('comício')).toBeNull()
    expect(resolveArchivePhotoScene(null)).toBeNull()
    expect(resolveArchivePhotoScene(7)).toBeNull()
    expect(resolveArchivePhotoScene('')).toBeNull()
  })
})

describe('archivePhotoThemesFrom (C232)', () => {
  it('resolves the existing taxonomy and drops the unknown', () => {
    expect(archivePhotoThemesFrom(['saude', 'Saúde', 'educacao', 'inventado', 7])).toEqual([
      'saude',
      'educacao',
    ])
    expect(archivePhotoThemesFrom([])).toEqual([])
  })
})

describe('matchPublicFigureMentions (C232)', () => {
  const name = publicFigureCatalog[0]!.name

  it('matches the curated catalog by whole word, accent/case insensitive', () => {
    expect(matchPublicFigureMentions(`Plenária com ${name} no palco`)).toEqual([name])
    expect(matchPublicFigureMentions(name.toLowerCase())).toEqual([name])
  })

  it('never invents a name and ignores unrelated text', () => {
    expect(matchPublicFigureMentions('Plenária em Vitória da Conquista')).toEqual([])
    expect(matchPublicFigureMentions('')).toEqual([])
  })
})

describe('parseArchiveVisionOutput (C232)', () => {
  it('parses a fenced JSON answer and normalizes the closed fields', () => {
    const answer = [
      '```json',
      JSON.stringify({
        caption: '  Plenária lotada no interior  ',
        description: 'Solla discursa para uma plateia cheia.',
        scene: 'Plenária',
        visibleText: 'SAÚDE É DIREITO',
        hasPeople: true,
        themes: ['Saúde', 'inventado'],
      }),
      '```',
    ].join('\n')

    expect(parseArchiveVisionOutput(answer)).toEqual({
      caption: 'Plenária lotada no interior',
      description: 'Solla discursa para uma plateia cheia.',
      scene: 'plenaria',
      visibleText: 'SAÚDE É DIREITO',
      hasPeople: true,
      themes: ['saude'],
    })
  })

  it('is null for a non-object answer (named failure upstream)', () => {
    expect(parseArchiveVisionOutput('resposta em prosa')).toBeNull()
    expect(parseArchiveVisionOutput('["a"]')).toBeNull()
    expect(parseArchiveVisionOutput('{quebrado')).toBeNull()
    expect(parseArchiveVisionOutput(null)).toBeNull()
  })

  it('degrades field by field instead of guessing', () => {
    expect(
      parseArchiveVisionOutput({
        caption: 42,
        scene: 'comício',
        themes: ['saude', 5],
        hasPeople: 'sim',
      }),
    ).toEqual({
      caption: null,
      description: null,
      scene: null,
      visibleText: null,
      hasPeople: null,
      themes: ['saude'],
    })
  })

  it('clips the caption to the field contract', () => {
    const parsed = parseArchiveVisionOutput({ caption: 'a'.repeat(500) })
    expect(parsed?.caption).toHaveLength(ARCHIVE_PHOTO_CAPTION_MAX_LENGTH)
  })
})

describe('archivePhotoTakenOn (C232)', () => {
  it('keeps the wall-clock day at noon UTC', () => {
    expect(archivePhotoTakenOn('2025-03-14 10:20:30')).toBe('2025-03-14T12:00:00.000Z')
    expect(archivePhotoTakenOn('2025-03-14')).toBe('2025-03-14T12:00:00.000Z')
  })

  it('is null for a missing or impossible date', () => {
    expect(archivePhotoTakenOn(null)).toBeNull()
    expect(archivePhotoTakenOn('14/03/2025')).toBeNull()
    expect(archivePhotoTakenOn('2025-02-31 10:00:00')).toBeNull()
  })
})

describe('changedArchivePhotoCuratedFields (C232)', () => {
  it('marks only what actually changed for a request with data', () => {
    expect(
      changedArchivePhotoCuratedFields({
        data: { alt: 'novo', catalog: { caption: 'x', scene: 'plenaria' } },
        originalDoc: { alt: 'velho', catalog: { caption: 'x', scene: null } },
      }),
    ).toEqual(['alt', 'scene'])
  })

  it('treats clearing and array edits as curation', () => {
    expect(
      changedArchivePhotoCuratedFields({
        data: { catalog: { themes: [], people: ['Fulano'] } },
        originalDoc: { catalog: { themes: ['saude'], people: ['Fulano'] } },
      }),
    ).toEqual(['themes'])
  })

  it('normalizes the relationship shape and ignores absent fields', () => {
    expect(
      changedArchivePhotoCuratedFields({
        data: { catalog: { municipality: { id: 5 } } },
        originalDoc: { catalog: { municipality: 5 } },
      }),
    ).toEqual([])
    expect(
      changedArchivePhotoCuratedFields({ data: {}, originalDoc: { catalog: { caption: 'x' } } }),
    ).toEqual([])
    expect(changedArchivePhotoCuratedFields({ data: null, originalDoc: {} })).toEqual([])
  })
})

describe('buildArchivePhotoCatalogWrite (C232)', () => {
  it('writes the model fields and derives the alt from the caption', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(
      writeInput({
        suggestion: suggestion({
          caption: 'Comício em Feira de Santana',
          description: 'Solla cumprimenta apoiadores.',
          scene: 'evento',
          visibleText: 'JUNTOS PELA BAHIA',
          hasPeople: true,
          themes: ['politica-instituicoes'],
        }),
      }),
    )

    expect(source).toBe('ai')
    expect(data.alt).toBe('Comício em Feira de Santana')
    expect(data.catalog).toEqual({
      caption: 'Comício em Feira de Santana',
      description: 'Solla cumprimenta apoiadores.',
      scene: 'evento',
      visibleText: 'JUNTOS PELA BAHIA',
      hasPeople: true,
      themes: ['politica-instituicoes'],
      source: 'ai',
      catalogedAt: '2026-09-26T12:00:00.000Z',
    })
  })

  it('states metadata when only the text-derived fields landed', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(
      writeInput({
        municipalityId: 7,
        mentionedPeople: ['Fulano de Tal'],
        gazetteerThemes: ['saude'],
      }),
    )

    expect(source).toBe('metadata')
    expect(data.alt).toBeUndefined()
    expect(data.catalog).toEqual({
      themes: ['saude'],
      people: ['Fulano de Tal'],
      municipality: 7,
      source: 'metadata',
      catalogedAt: '2026-09-26T12:00:00.000Z',
    })
  })

  it('states none when there was nothing to propose', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(writeInput())

    expect(source).toBe('none')
    expect(data.catalog).toEqual({
      source: 'none',
      catalogedAt: '2026-09-26T12:00:00.000Z',
    })
  })

  it('never overwrites a curated field, and the source reflects only what landed', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(
      writeInput({
        suggestion: suggestion({ caption: 'IA', themes: ['saude'] }),
        municipalityId: 9,
        curatedFields: ['caption', 'themes', 'municipality'],
        currentCatalog: { caption: 'Humano', themes: ['esporte'], municipality: 3 },
      }),
    )

    expect(source).toBe('none')
    expect(data.catalog).toEqual({
      caption: 'Humano',
      themes: ['esporte'],
      municipality: 3,
      source: 'none',
      catalogedAt: '2026-09-26T12:00:00.000Z',
    })
    expect(data.alt).toBeUndefined()
  })

  it('keeps writing when the curation freezes only one field', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(
      writeInput({
        suggestion: suggestion({ caption: 'IA', description: 'Descrição da IA' }),
        curatedFields: ['caption'],
        currentCatalog: { caption: 'Humano' },
        currentAlt: 'Alt humano',
      }),
    )

    expect(source).toBe('ai')
    expect(data.catalog.caption).toBe('Humano')
    expect(data.catalog.description).toBe('Descrição da IA')
    // The curated caption freezes the alt refinement too (never mirrors human text).
    expect(data.alt).toBeUndefined()
  })

  it('keeps a curated alt and never mirrors the curated caption into it', () => {
    const { data } = buildArchivePhotoCatalogWrite(
      writeInput({
        suggestion: suggestion({ caption: 'IA' }),
        curatedFields: ['alt', 'caption'],
        currentCatalog: { caption: 'Humano' },
        currentAlt: 'Alt humano',
      }),
    )

    expect(data.alt).toBe('Alt humano')
    expect(data.catalog.caption).toBe('Humano')
  })

  it('writes a negative hasPeople as a real proposal, never a blank string', () => {
    const negative = buildArchivePhotoCatalogWrite(
      writeInput({ suggestion: suggestion({ hasPeople: false }) }),
    )
    expect(negative.source).toBe('ai')
    expect(negative.data.catalog.hasPeople).toBe(false)

    const blank = buildArchivePhotoCatalogWrite(
      writeInput({ suggestion: suggestion({ caption: '   ' }) }),
    )
    expect(blank.source).toBe('none')
    expect(blank.data.catalog.caption).toBeUndefined()
  })

  it('unions the model themes with the gazetteer without duplicating', () => {
    const { data, source } = buildArchivePhotoCatalogWrite(
      writeInput({
        suggestion: suggestion({ themes: ['saude'] }),
        gazetteerThemes: ['saude', 'educacao'],
      }),
    )

    expect(source).toBe('ai')
    expect(data.catalog.themes).toEqual(['saude', 'educacao'])
  })
})

describe('archivePhotoSearchText (C232)', () => {
  it('normalizes every facet into one haystack', () => {
    const text = archivePhotoSearchText({
      alt: 'Comício',
      title: 'Plenária',
      description: 'Evento',
      catalogDescription: 'Descrição IA',
      caption: 'Legenda',
      scene: 'plenaria',
      visibleText: 'SAÚDE',
      themes: ['saude'],
      people: ['Fulano de Tal'],
      municipalityName: 'Feira de Santana',
      albumTitles: ['Vitória da Conquista'],
      tagNames: ['Solla'],
    })

    expect(text).toContain('comicio')
    expect(text).toContain('plenaria')
    expect(text).toContain('saude')
    expect(text).toContain('fulano de tal')
    expect(text).toContain('feira de santana')
    expect(text).toContain('vitoria da conquista')
    expect(text).toContain('solla')
  })

  it('is empty for an empty input', () => {
    expect(archivePhotoSearchText({})).toBe('')
  })
})
