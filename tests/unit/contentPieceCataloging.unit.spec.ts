// @vitest-environment node

import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { SpeechTopic } from '@/lib/speechFacets'
import {
  buildContentPieceFallbackMetadata,
  catalogContentPiece,
  resolveContentPieceInstitution,
  resolveContentPieceMunicipalityId,
} from '@/utilities/content/contentPieceCataloging'

/**
 * C211 — the automatic cataloguing is fail-closed: it fills only what it is
 * confident about, never invents a city/institution, and a provider failure
 * degrades to the deterministic fallback instead of breaking the job.
 */

const fakePayload = (
  overrides: {
    municipalitySlug?: string | null
    municipalityName?: string | null
  } = {},
): Payload =>
  ({
    find: vi.fn(async () =>
      overrides.municipalitySlug
        ? { docs: [{ id: 42, slug: overrides.municipalitySlug }] }
        : { docs: [] },
    ),
    findByID: vi.fn(async () =>
      overrides.municipalityName ? { id: 42, name: overrides.municipalityName } : null,
    ),
  }) as unknown as Payload

const classifierOf = (topics: SpeechTopic[]) => vi.fn(async () => ({ facets: { topics } }))

const suggesterOf = (title: string, description: string) =>
  vi.fn(async () => ({ title, description, source: 'ai' as const }))

describe('resolveContentPieceMunicipalityId', () => {
  it('resolves a single unambiguous city mention', async () => {
    const payload = fakePayload({ municipalitySlug: 'feira-de-santana' })
    await expect(
      resolveContentPieceMunicipalityId({
        payload,
        transcript: 'Estivemos em Feira de Santana para falar da escala 6x1.',
      }),
    ).resolves.toBe(42)
  })

  it('stays empty when no city or more than one city is mentioned', async () => {
    const payload = fakePayload({ municipalitySlug: 'feira-de-santana' })
    await expect(
      resolveContentPieceMunicipalityId({ payload, transcript: 'Uma fala sobre saúde.' }),
    ).resolves.toBeNull()
    await expect(
      resolveContentPieceMunicipalityId({
        payload,
        transcript: 'Passamos por Feira de Santana e por Vitória da Conquista.',
      }),
    ).resolves.toBeNull()
  })

  it('keeps Salvador ambiguous (one catalog entry per TSE zone)', async () => {
    const payload = fakePayload({ municipalitySlug: 'salvador-ze-3' })
    await expect(
      resolveContentPieceMunicipalityId({ payload, transcript: 'Comício em Salvador.' }),
    ).resolves.toBeNull()
  })
})

describe('resolveContentPieceInstitution', () => {
  it('matches a catalog spelling as a whole word', () => {
    expect(resolveContentPieceInstitution('A UFBA abriu o edital.')).toBe('UFBA')
    expect(resolveContentPieceInstitution('Falamos sobre a Universidade Federal da Bahia.')).toBe(
      'UFBA',
    )
  })

  it('never matches a partial word and refuses ambiguity', () => {
    expect(resolveContentPieceInstitution('A ufbanana nao existe.')).toBeUndefined()
    expect(
      resolveContentPieceInstitution('A UFBA e os Correios firmaram o acordo.'),
    ).toBeUndefined()
  })
})

describe('buildContentPieceFallbackMetadata', () => {
  it('never returns an empty title or description', () => {
    const fallback = buildContentPieceFallbackMetadata({
      type: 'video',
      currentTitle: '',
      cityLabel: null,
      topics: [],
    })
    expect(fallback.title).toBe('Peça de vídeo')
    expect(fallback.description).toContain('Vídeo da campanha de Jorge Solla 1313')
    expect(fallback.source).toBe('fallback')
  })

  it('uses the city and the topic labels when present', () => {
    const fallback = buildContentPieceFallbackMetadata({
      type: 'audio',
      currentTitle: 'Mensagem para lideranças',
      cityLabel: 'Feira de Santana',
      topics: ['saude', 'economia-trabalho'],
    })
    expect(fallback.title).toBe('Mensagem para lideranças')
    expect(fallback.description).toBe(
      'Áudio da campanha de Jorge Solla 1313 em Feira de Santana sobre Saúde, Economia e Trabalho.',
    )
  })
})

describe('catalogContentPiece', () => {
  it('skips every external call when there is no text', async () => {
    const classify = classifierOf([])
    const suggest = suggesterOf('t', 'd')
    const result = await catalogContentPiece({
      payload: fakePayload(),
      type: 'foto',
      title: 'Card da feira',
      transcript: null,
      classify,
      suggest,
    })

    expect(result).toEqual({ source: 'none' })
    expect(classify).not.toHaveBeenCalled()
    expect(suggest).not.toHaveBeenCalled()
  })

  it('fills city, topics, institution and the suggestion when confident', async () => {
    const payload = fakePayload({
      municipalitySlug: 'feira-de-santana',
      municipalityName: 'Feira de Santana',
    })
    const result = await catalogContentPiece({
      payload,
      type: 'video',
      title: 'Instagram · ABC',
      transcript: 'A UFBA recebeu o anúncio em Feira de Santana sobre a jornada 6x1.',
      classify: classifierOf(['saude', 'economia-trabalho']),
      suggest: suggesterOf('Fim da escala 6x1', 'Solla explica a jornada.'),
    })

    expect(result).toEqual({
      title: 'Fim da escala 6x1',
      description: 'Solla explica a jornada.',
      topics: ['saude', 'economia-trabalho'],
      municipalityId: 42,
      institution: 'UFBA',
      source: 'ai',
    })
  })

  it('keeps the fallback metadata when the suggester degrades', async () => {
    const result = await catalogContentPiece({
      payload: fakePayload(),
      type: 'texto',
      title: 'Mensagem do grupo',
      transcript: 'Texto curto para o grupo.',
      classify: classifierOf([]),
      suggest: vi.fn(async () => ({
        title: 'Mensagem do grupo',
        description: 'Texto da campanha.',
        source: 'fallback' as const,
      })),
    })

    expect(result.source).toBe('fallback')
    expect(result.title).toBe('Mensagem do grupo')
    expect(result.description).toBe('Texto da campanha.')
    expect(result.topics).toBeUndefined()
    expect(result.municipalityId).toBeUndefined()
    expect(result.institution).toBeUndefined()
  })

  it('survives a classifier that throws', async () => {
    const result = await catalogContentPiece({
      payload: fakePayload(),
      type: 'video',
      title: 'Peça',
      transcript: 'Uma fala qualquer sem cidade.',
      classify: vi.fn(async () => {
        throw new Error('provider down')
      }),
      suggest: suggesterOf('Título', 'Descrição'),
    })

    expect(result.source).toBe('ai')
    expect(result.topics).toBeUndefined()
  })
})
