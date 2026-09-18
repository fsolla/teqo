// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  mergeFacetClassification,
  parseLlmFacetResponse,
  resolveSpeechTopic,
} from '@/lib/speechFacets'
import { classifySpeechByGazetteer, matchMunicipalityMentions } from '@/lib/speechGazetteer'

describe('resolveSpeechTopic (C190)', () => {
  it('resolves the canonical value and the pt-BR label (accent/case insensitive)', () => {
    expect(resolveSpeechTopic('educacao')?.value).toBe('educacao')
    expect(resolveSpeechTopic('Educação')?.value).toBe('educacao')
    expect(resolveSpeechTopic('  EDUCAÇÃO  ')?.value).toBe('educacao')
    expect(resolveSpeechTopic('Seguranca Publica')?.value).toBe('seguranca-publica')
    expect(resolveSpeechTopic('Direitos Humanos e Assistência Social')?.value).toBe(
      'direitos-humanos',
    )
  })

  it('fails closed on an unknown or empty token (never an invented slug)', () => {
    expect(resolveSpeechTopic('educacao-infantil')).toBeNull()
    expect(resolveSpeechTopic('')).toBeNull()
    expect(resolveSpeechTopic('   ')).toBeNull()
  })
})

describe('classifySpeechByGazetteer', () => {
  it('detects topics, explicit scopes and municipality mentions', () => {
    const result = classifySpeechByGazetteer({
      summary: 'Investimentos em saúde e educação na Bahia.',
      keywords: ['SUS', 'Escola'],
      transcript: 'Defendemos o SUS, a escola pública e a universidade em Feira de Santana.',
    })

    expect(result.topics).toContain('saude')
    expect(result.topics).toContain('educacao')
    expect(result.scopes).toContain('bahia')
    expect(result.municipalities.map((entry) => entry.slug)).toContain('feira-de-santana')
    expect(result.people).toEqual([])
    expect(result.programs).toEqual([])
    expect(result.projects).toEqual([])
  })

  it('matches whole words only (no "sus" inside "suspeito")', () => {
    const result = classifySpeechByGazetteer({
      transcript: 'O suspeito foi ouvido e liberado.',
    })

    expect(result.topics).not.toContain('saude')
  })

  it('infers the Bahia scope from a municipality mention alone', () => {
    const result = classifySpeechByGazetteer({
      transcript: 'A cidade de Vitória da Conquista recebeu o investimento.',
    })

    expect(result.scopes).toEqual(['bahia'])
  })

  it('ignores official keywords for place mentions (controlled topic vocabulary)', () => {
    const result = classifySpeechByGazetteer({
      summary: 'Debate sobre financiamento da educação.',
      keywords: ['Saúde', 'Educação', 'Governo federal'],
      transcript: 'Precisamos investir na educação pública.',
    })

    expect(result.topics).toContain('saude')
    expect(result.municipalities).toEqual([])

    const withPlace = classifySpeechByGazetteer({
      summary: 'Investimento em Saúde, no interior da Bahia.',
      transcript: 'A comitiva esteve em Saúde.',
    })
    expect(withPlace.municipalities.map((entry) => entry.slug)).toEqual(['saude'])
  })
})

describe('matchMunicipalityMentions', () => {
  it('consumes the longest name (São Félix do Coribe never also yields Coribe)', () => {
    const slugs = matchMunicipalityMentions('Ele passou por São Félix do Coribe.').map(
      (entry) => entry.slug,
    )

    expect(slugs).toEqual(['sao-felix-do-coribe'])
  })

  it('does not split a longer name into a shorter one (Condeúba is not Conde)', () => {
    const slugs = matchMunicipalityMentions('A comitiva esteve em Condeúba.').map(
      (entry) => entry.slug,
    )

    expect(slugs).toEqual(['condeuba'])
  })

  it('requires a capitalized proper noun (prose "saúde" is not the municipality Saúde)', () => {
    expect(matchMunicipalityMentions('A saúde pública é prioridade.')).toEqual([])
    expect(
      matchMunicipalityMentions('A agenda passou em Saúde, no interior da Bahia.').map(
        (entry) => entry.slug,
      ),
    ).toEqual(['saude'])
  })

  it('requires a place context for ambiguous names (Saúde, Wagner, Santana)', () => {
    expect(matchMunicipalityMentions('A visita da Ministra da Saúde foi destaque.')).toEqual([])
    expect(matchMunicipalityMentions('O senador Jaques Wagner discursou.')).toEqual([])
    expect(matchMunicipalityMentions('O deputado Santana votou com o governo.')).toEqual([])
    expect(
      matchMunicipalityMentions('Ele esteve em Saúde, no interior.').map((entry) => entry.slug),
    ).toEqual(['saude'])
    expect(
      matchMunicipalityMentions('A comitiva passou em Wagner.').map((entry) => entry.slug),
    ).toEqual(['wagner'])
  })

  it('ignores institutional phrases that contain a municipality name', () => {
    expect(matchMunicipalityMentions('O Sistema Único de Saúde atende a população.')).toEqual([])
    expect(matchMunicipalityMentions('O Banco Central elevou os juros.')).toEqual([])
    expect(matchMunicipalityMentions('O Palácio do Planalto confirmou a agenda.')).toEqual([])
    expect(
      matchMunicipalityMentions('Ele esteve em Central, no interior da Bahia.').map(
        (entry) => entry.slug,
      ),
    ).toEqual(['central'])
  })

  it('maps a Salvador mention to its 19 zone entries', () => {
    const slugs = matchMunicipalityMentions('O comício foi em Salvador.').map((entry) => entry.slug)

    expect(slugs).toHaveLength(19)
    expect(slugs.every((slug) => slug.startsWith('salvador-ze-'))).toBe(true)
  })
})

describe('parseLlmFacetResponse', () => {
  it('maps labels and values to the taxonomy, dropping unknown values', () => {
    expect(
      parseLlmFacetResponse({
        topics: ['Saúde', 'seguranca-publica', 'inexistente'],
        scopes: ['Bahia', 'Mundo'],
        people: ['Dilma Rousseff', 'dilma rousseff', ''],
        programs: ['Minha Casa, Minha Vida'],
        projects: ['PEC 45'],
      }),
    ).toEqual({
      topics: ['saude', 'seguranca-publica'],
      scopes: ['bahia'],
      people: ['Dilma Rousseff'],
      programs: ['Minha Casa, Minha Vida'],
      projects: ['PEC 45'],
    })
  })

  it('maps the long labels too', () => {
    const parsed = parseLlmFacetResponse({
      topics: ['Direitos Humanos e Assistência Social', 'Infraestrutura e Transporte'],
    })

    expect(parsed?.topics).toEqual(['direitos-humanos', 'infraestrutura'])
  })

  it('returns null for a response without any known key', () => {
    expect(parseLlmFacetResponse(null)).toBeNull()
    expect(parseLlmFacetResponse('texto')).toBeNull()
    expect(parseLlmFacetResponse({ foo: 1 })).toBeNull()
  })

  it('caps and truncates the free-text mentions', () => {
    const parsed = parseLlmFacetResponse({
      people: Array.from({ length: 20 }, (_, index) => `Pessoa ${index}`),
      programs: ['x'.repeat(200)],
    })

    expect(parsed?.people).toHaveLength(12)
    expect(parsed?.programs[0]).toHaveLength(120)
  })
})

describe('mergeFacetClassification', () => {
  const gazetteer = classifySpeechByGazetteer({
    transcript: 'O SUS e a escola pública em Feira de Santana.',
  })

  it('unions topics and prefers the validated LLM scopes', () => {
    const merged = mergeFacetClassification(gazetteer, {
      topics: ['cultura'],
      scopes: ['brasil'],
      people: ['Lula'],
      programs: [],
      projects: [],
    })

    expect(merged.topics).toEqual([...gazetteer.topics, 'cultura'])
    expect(merged.scopes).toEqual(['brasil'])
    expect(merged.people).toEqual(['Lula'])
    expect(merged.classifiedBy).toBe('llm')
  })

  it('keeps the gazetteer provenance without an LLM response', () => {
    const merged = mergeFacetClassification(gazetteer, null)

    expect(merged.classifiedBy).toBe('gazetteer')
    expect(merged.scopes).toEqual(gazetteer.scopes)
    expect(merged.municipalities).toEqual(gazetteer.municipalities)
  })
})
