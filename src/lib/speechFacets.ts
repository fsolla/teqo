import { z } from 'zod'

import type { MunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { normalizeForSearch, uniqueByNormalizedForm } from '@/lib/speechSearch'

/**
 * Facet contract for the speech catalog (C153). The topic and scope values are
 * persisted data (facet filters in C154); labels are the pt-BR product names.
 * The offline gazetteer lives in `speechGazetteer.ts` and the LLM refinement in
 * `src/utilities/speech/speechClassifier.ts`; this module validates the LLM
 * response and merges both provenances. `manual` edits win over both.
 */

export const SPEECH_TOPICS = [
  { value: 'saude', label: 'Saúde' },
  { value: 'educacao', label: 'Educação' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'esporte', label: 'Esporte' },
  { value: 'seguranca-publica', label: 'Segurança Pública' },
  { value: 'meio-ambiente', label: 'Meio Ambiente' },
  { value: 'economia-trabalho', label: 'Economia e Trabalho' },
  { value: 'direitos-humanos', label: 'Direitos Humanos e Assistência Social' },
  { value: 'infraestrutura', label: 'Infraestrutura e Transporte' },
  { value: 'ciencia-tecnologia', label: 'Ciência e Tecnologia' },
  { value: 'politica-instituicoes', label: 'Política e Instituições' },
  { value: 'agricultura', label: 'Agricultura e Agropecuária' },
  { value: 'habitacao-cidades', label: 'Habitação e Cidades' },
  { value: 'comunicacao-midia', label: 'Comunicação e Mídia' },
  { value: 'igualdade-racial', label: 'Igualdade Racial' },
  { value: 'mulheres-genero', label: 'Mulheres e Gênero' },
  { value: 'juventude', label: 'Juventude' },
  { value: 'pessoa-deficiencia', label: 'Pessoa com Deficiência' },
] as const

export type SpeechTopic = (typeof SPEECH_TOPICS)[number]['value']

export const SPEECH_SCOPES = [
  { value: 'bahia', label: 'Bahia' },
  { value: 'brasil', label: 'Brasil' },
  { value: 'internacional', label: 'Internacional' },
] as const

export type SpeechScope = (typeof SPEECH_SCOPES)[number]['value']

export const SPEECH_CLASSIFICATION_SOURCES = ['gazetteer', 'llm', 'manual'] as const

type SpeechClassificationSource = (typeof SPEECH_CLASSIFICATION_SOURCES)[number]

export type SpeechFacetClassification = {
  topics: SpeechTopic[]
  scopes: SpeechScope[]
  municipalities: MunicipalityCatalogEntry[]
  people: string[]
  programs: string[]
  projects: string[]
}

export type MergedSpeechFacets = SpeechFacetClassification & {
  classifiedBy: SpeechClassificationSource
}

const facetKey = (value: string): string => normalizeForSearch(value).replace(/-/g, ' ')

const topicByKey = new Map(
  SPEECH_TOPICS.flatMap(({ value, label }) => [
    [facetKey(value), value],
    [facetKey(label), value],
  ]),
)

const scopeByKey = new Map(
  SPEECH_SCOPES.flatMap(({ value, label }) => [
    [facetKey(value), value],
    [facetKey(label), value],
  ]),
)

/**
 * Resolves a canonical topic token (value or pt-BR label, accent/case
 * insensitive) to its taxonomy entry. Fail-closed: unknown tokens return null —
 * callers never invent a slug outside `SPEECH_TOPICS` (C190).
 */
export const resolveSpeechTopic = (token: string): (typeof SPEECH_TOPICS)[number] | null => {
  const key = facetKey(token ?? '')
  if (!key) return null
  const value = topicByKey.get(key)
  return SPEECH_TOPICS.find((topic) => topic.value === value) ?? null
}

// ---------------------------------------------------------------------------
// LLM response parsing and merge
// ---------------------------------------------------------------------------

const MAX_MENTION_ITEMS = 12
const MAX_MENTION_LENGTH = 120

const llmFacetResponseSchema = z.object({
  topics: z.array(z.unknown()).optional(),
  scopes: z.array(z.unknown()).optional(),
  people: z.array(z.unknown()).optional(),
  programs: z.array(z.unknown()).optional(),
  projects: z.array(z.unknown()).optional(),
})

export type SpeechLlmFacets = {
  topics: SpeechTopic[]
  scopes: SpeechScope[]
  people: string[]
  programs: string[]
  projects: string[]
}

const stringMentions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return uniqueByNormalizedForm(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim().slice(0, MAX_MENTION_LENGTH)),
  ).slice(0, MAX_MENTION_ITEMS)
}

/**
 * Validates the LLM JSON response against the known taxonomy. Unknown topics
 * and scopes are dropped (never persisted as free text); an object without any
 * known key returns null so the caller falls back to the gazetteer provenance.
 */
export const parseLlmFacetResponse = (json: unknown): SpeechLlmFacets | null => {
  const parsed = llmFacetResponseSchema.safeParse(json)
  if (!parsed.success || Object.keys(parsed.data).length === 0) return null
  const data = parsed.data

  const topics = uniqueByNormalizedForm(
    (Array.isArray(data.topics) ? data.topics : []).filter(
      (item): item is string => typeof item === 'string',
    ),
  )
    .map((item) => topicByKey.get(facetKey(item)))
    .filter((value): value is SpeechTopic => value !== undefined)

  const scopes = uniqueByNormalizedForm(
    (Array.isArray(data.scopes) ? data.scopes : []).filter(
      (item): item is string => typeof item === 'string',
    ),
  )
    .map((item) => scopeByKey.get(facetKey(item)))
    .filter((value): value is SpeechScope => value !== undefined)

  return {
    topics: [...new Set(topics)],
    scopes: [...new Set(scopes)],
    people: stringMentions(data.people),
    programs: stringMentions(data.programs),
    projects: stringMentions(data.projects),
  }
}

/**
 * Gazetteer ∪ LLM. Topics are unioned (the lexicon is evidence too); scopes
 * prefer the validated LLM output when it produced any; people/programs/
 * projects come from the LLM only. Provenance is `llm` whenever a valid
 * response refined the result, `gazetteer` otherwise.
 */
export const mergeFacetClassification = (
  gazetteer: SpeechFacetClassification,
  llm: SpeechLlmFacets | null,
): MergedSpeechFacets => {
  if (!llm) return { ...gazetteer, classifiedBy: 'gazetteer' }

  return {
    topics: [...new Set([...gazetteer.topics, ...llm.topics])],
    scopes: llm.scopes.length > 0 ? llm.scopes : gazetteer.scopes,
    municipalities: gazetteer.municipalities,
    people: llm.people,
    programs: llm.programs,
    projects: llm.projects,
    classifiedBy: 'llm',
  }
}
