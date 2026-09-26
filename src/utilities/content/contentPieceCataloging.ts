import 'server-only'

import { deepSeek } from '@ai-sdk/deepseek'
import { generateObject } from 'ai'
import type { Payload } from 'payload'
import { z } from 'zod'

import {
  CONTENT_PIECE_DESCRIPTION_MAX_LENGTH,
  CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
  CONTENT_PIECE_TITLE_MAX_LENGTH,
  contentPieceTopicLabel,
  contentPieceTypeLabels,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { institutionCatalog, institutionSpellings } from '@/lib/institutionCatalog'
import { type SpeechTopic } from '@/lib/speechFacets'
import { type SpeechFacetInput } from '@/lib/speechGazetteer'
import { escapeRegExp, normalizeForSearch } from '@/lib/speechSearch'
import {
  DEEPSEEK_FLASH_STRUCTURED_MAX_OUTPUT_TOKENS,
  DEEPSEEK_FLASH_STRUCTURED_PROVIDER_OPTIONS,
} from '@/utilities/ai/deepseekFlashDefaults'
import { resolveMentionedMunicipalityId } from '@/utilities/municipality/municipalityMentionResolver'
import { classifySpeech } from '@/utilities/speech/speechClassifier'

/**
 * C211 — the automatic cataloguing of one content piece: the offline gazetteer
 * for city/topics, the C153 classifier (gazetteer + validated LLM refinement)
 * for the themes and one bounded DeepSeek call for title/description. Every
 * step is fail-closed and never throws: a provider outage degrades to the
 * deterministic fallback, and the assessoria's edits always win (the job only
 * writes fields absent from `curatedFields`).
 */

const SUGGESTION_TIMEOUT_MS = 8000
const MAX_EXCERPT_CHARS = 2000

export type ContentPieceCatalogResult = {
  title?: string
  description?: string
  topics?: SpeechTopic[]
  municipalityId?: number | null
  institution?: string
  source: 'ai' | 'fallback' | 'none'
}

type ContentPieceClassifier = (input: SpeechFacetInput) => Promise<{
  facets: { topics: SpeechTopic[] }
}>

type ContentPieceSuggester = (input: {
  type: ContentPieceType
  currentTitle: string
  transcript: string
  cityLabel: string | null
  topics: readonly SpeechTopic[]
}) => Promise<{ title: string; description: string; source: 'ai' | 'fallback' }>

const suggestionSchema = z.object({
  title: z
    .string()
    .describe('Título curto em português (no máximo 120 caracteres), sem aspas nem prefixos.'),
  description: z
    .string()
    .describe(
      'Descrição factual em português (no máximo 600 caracteres) do que a peça mostra, sem inventar fatos.',
    ),
})

const SYSTEM_PROMPT =
  'Você cataloga peças de campanha do deputado federal Jorge Solla (PT-BA) para a Central de Conteúdos da campanha. ' +
  'Receberá o tipo da peça e a transcrição automática (ASR) do material, que pode ter ruído. ' +
  'Escreva um título curto e concreto (o assunto da peça, não o nome do deputado) e uma descrição de uma a duas ' +
  'frases, em português do Brasil, adequadas para apresentar o material a quem vai compartilhar no WhatsApp. ' +
  'Use apenas o que está na transcrição; nunca invente números, acordos, cidades ou citações.'

const clip = (value: string, maximum: number): string => value.trim().slice(0, maximum).trim()

/** Deterministic fallback: never empty, never invents a fact. */
export const buildContentPieceFallbackMetadata = ({
  type,
  currentTitle,
  cityLabel,
  topics,
}: {
  type: ContentPieceType
  currentTitle: string
  cityLabel: string | null
  topics: readonly SpeechTopic[]
}): { title: string; description: string; source: 'fallback' } => {
  const typeLabel = contentPieceTypeLabels[type].toLowerCase()
  const topicLabels = topics.slice(0, 3).map(contentPieceTopicLabel)
  const parts = [
    `${contentPieceTypeLabels[type]} da campanha de Jorge Solla 1313`,
    cityLabel ? `em ${cityLabel}` : null,
    topicLabels.length > 0 ? `sobre ${topicLabels.join(', ')}` : null,
  ].filter((part): part is string => part !== null)

  return {
    title: clip(currentTitle, CONTENT_PIECE_TITLE_MAX_LENGTH) || `Peça de ${typeLabel}`,
    description: clip(`${parts.join(' ')}.`, CONTENT_PIECE_DESCRIPTION_MAX_LENGTH),
    source: 'fallback',
  }
}

/**
 * One-shot AI title/description for the piece, on the same DeepSeek path as
 * the acervo AI (C167): never throws, never blocks the job. Missing key, empty
 * excerpt, timeout or unusable output all resolve to the deterministic
 * fallback.
 */
const suggestContentPieceMetadata: ContentPieceSuggester = async ({
  type,
  currentTitle,
  transcript,
  cityLabel,
  topics,
}) => {
  const fallback = buildContentPieceFallbackMetadata({ type, currentTitle, cityLabel, topics })
  const excerpt = transcript.trim().slice(0, MAX_EXCERPT_CHARS)
  if (!excerpt || !process.env.DEEPSEEK_API_KEY) return fallback

  try {
    const { object } = await generateObject({
      model: deepSeek('deepseek-flash'),
      schema: suggestionSchema,
      system: SYSTEM_PROMPT,
      prompt: [
        `Tipo: ${contentPieceTypeLabels[type]}`,
        `Título atual: ${currentTitle}`,
        cityLabel ? `Cidade: ${cityLabel}` : null,
        `Transcrição (ASR): "${excerpt}"`,
      ]
        .filter((line): line is string => line !== null)
        .join('\n'),
      temperature: 0.3,
      maxOutputTokens: DEEPSEEK_FLASH_STRUCTURED_MAX_OUTPUT_TOKENS,
      providerOptions: DEEPSEEK_FLASH_STRUCTURED_PROVIDER_OPTIONS,
      abortSignal: AbortSignal.timeout(SUGGESTION_TIMEOUT_MS),
    })

    const title = clip(object.title, CONTENT_PIECE_TITLE_MAX_LENGTH)
    const description = clip(object.description, CONTENT_PIECE_DESCRIPTION_MAX_LENGTH)
    if (!title || !description) return fallback
    return { title, description, source: 'ai' }
  } catch {
    return fallback
  }
}

/**
 * The content-piece entry point to the shared conservative city rule
 * (`resolveMentionedMunicipalityId`): only a city with exactly ONE catalog
 * entry resolves, and a bare "Salvador" stays empty — the assessoria picks the
 * zone on the ficha.
 */
export const resolveContentPieceMunicipalityId = async ({
  payload,
  transcript,
}: {
  payload: Payload
  transcript: string
}): Promise<number | null> => resolveMentionedMunicipalityId({ payload, text: transcript })

/**
 * Matches the institution catalog against the text: a spelling counts only as a
 * whole word (accent/case insensitive), and more than one matching institution
 * is ambiguous and stays empty.
 */
export const resolveContentPieceInstitution = (transcript: string): string | undefined => {
  const haystack = normalizeForSearch(transcript)
  const matched = institutionCatalog.filter((entry) =>
    institutionSpellings(entry).some((spelling) => {
      const needle = normalizeForSearch(spelling)
      return (
        needle.length > 0 &&
        new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(haystack)
      )
    }),
  )
  return matched.length === 1 ? matched[0]!.name : undefined
}

/**
 * The cataloguing entry point of the job. Runs the gazetteer + the C153
 * classifier + the suggestion, and returns only what it is confident about.
 * An empty transcript (a photo, a card, a silent video) skips every external
 * call and returns `source: 'none'` — the type/title the upload derived stay.
 */
export const catalogContentPiece = async ({
  payload,
  type,
  title,
  transcript,
  classify = classifySpeech,
  suggest = suggestContentPieceMetadata,
}: {
  payload: Payload
  type: ContentPieceType
  title: string
  transcript: string | null
  classify?: ContentPieceClassifier
  suggest?: ContentPieceSuggester
}): Promise<ContentPieceCatalogResult> => {
  const text = transcript?.trim() ?? ''
  if (!text) return { source: 'none' }

  let topics: SpeechTopic[] = []
  try {
    const classification = await classify({ transcript: text })
    topics = [...new Set(classification.facets.topics)]
  } catch {
    // The classifier contract is "never throws"; if it does, the catalogue
    // still gets city/institution/title from the gazetteer and the fallback.
  }

  const municipalityId = await resolveContentPieceMunicipalityId({ payload, transcript: text })
  const municipality = municipalityId
    ? await payload
        .findByID({
          collection: 'municipality',
          id: municipalityId,
          depth: 0,
          select: { name: true },
          // Intentional admin bypass: the município catalog is read-only geography.
          overrideAccess: true,
        })
        .catch(() => null)
    : null

  const suggestion = await suggest({
    type,
    currentTitle: title,
    transcript: text,
    cityLabel: municipality?.name ?? null,
    topics,
  })
  const institution = resolveContentPieceInstitution(text)?.slice(
    0,
    CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
  )

  return {
    title: suggestion.title,
    description: suggestion.description,
    ...(topics.length > 0 ? { topics } : {}),
    ...(municipalityId !== null ? { municipalityId } : {}),
    ...(institution ? { institution } : {}),
    source: suggestion.source,
  }
}
