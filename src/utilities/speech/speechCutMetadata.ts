import 'server-only'

import { deepSeek } from '@ai-sdk/deepseek'
import { generateObject } from 'ai'
import { z } from 'zod'

import {
  buildSpeechCutFallbackMetadata,
  clipSpeechCutText,
  type SpeechCutSourceKind,
} from '@/lib/speechCut'

const SUGGESTION_TIMEOUT_MS = 6000
const MAX_EXCERPT_CHARS = 1200
const MAX_TITLE_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 600
const MAX_OUTPUT_TOKENS = 400

type SpeechCutMetadataSource = 'ai' | 'fallback'

export type SpeechCutMetadataSuggestion = {
  title: string
  description: string
  source: SpeechCutMetadataSource
}

export type SpeechCutMetadataSegment = {
  startSeconds: number
  endSeconds: number
  text: string
}

const suggestionSchema = z.object({
  title: z
    .string()
    .describe('Título curto em português (no máximo 120 caracteres), sem aspas nem prefixos.'),
  description: z
    .string()
    .describe(
      'Descrição factual em português (no máximo 600 caracteres) do que o trecho diz, sem inventar fatos.',
    ),
})

/**
 * The rules every suggestion shares; only the first line (which catalog this
 * is), the evidence sentence and the word naming the anchor change per source —
 * composing keeps the two from drifting apart.
 */
const systemPromptTail = (evidence: string): string =>
  'Escreva um título curto e concreto (o assunto do trecho, não o nome do deputado) e uma descrição de uma ' +
  'a duas frases, em português do Brasil, adequadas para compartilhar o vídeo no WhatsApp. ' +
  `Use apenas o que está no trecho e no ${evidence}; nunca invente números, acordos ou citações, e a ` +
  'transcrição pode ter ruído.'

const SYSTEM_PROMPT =
  'Você prepara cortes de falas do deputado federal Jorge Solla no acervo da Câmara dos Deputados. ' +
  'Receberá tipo, data, resumo oficial e a transcrição automática (ASR) de um trecho da fala com 5 segundos ou mais. ' +
  systemPromptTail('resumo')

/** C217 — the web speech has no official type/summary; the title is the anchor. */
const WEB_SYSTEM_PROMPT =
  'Você prepara cortes de falas do deputado federal Jorge Solla publicadas na internet. ' +
  'Receberá título, plataforma, data e a transcrição automática (ASR) de um trecho da fala com 5 segundos ou mais. ' +
  systemPromptTail('título')

const promptFrom = (lines: readonly (string | null)[]): string =>
  lines.filter((line): line is string => line !== null).join('\n')

const excerptOf = (
  segments: readonly SpeechCutMetadataSegment[],
  startSeconds: number,
  endSeconds: number,
): string =>
  clipSpeechCutText(
    segments
      .filter((segment) => segment.endSeconds > startSeconds && segment.startSeconds < endSeconds)
      .map((segment) => segment.text.trim())
      .filter((text) => text !== '')
      .join(' '),
    MAX_EXCERPT_CHARS,
  )

/**
 * C167 — one-shot AI title/description for the picked window, on the same
 * DeepSeek path as the other acervo AI (C158/B195): never throws and never
 * blocks the cut. Missing key, empty excerpt, timeout or unusable output all
 * resolve to the deterministic fallback.
 *
 * C217 — `source` (default Câmara, bytes preserved) swaps the system prompt and
 * the anchor line for a web speech: title/platform instead of official
 * type/summary, still never inventing facts.
 */
export const suggestSpeechCutMetadata = async ({
  speechType,
  dateLabel,
  summary,
  source = 'camara',
  speechTitle = null,
  platformLabel = null,
  segments,
  startSeconds,
  endSeconds,
}: {
  speechType: string | null
  dateLabel: string
  summary: string | null
  source?: SpeechCutSourceKind
  /** Web only — the publication title anchors the suggestion. */
  speechTitle?: string | null
  /** Web only — the pt-BR platform label. */
  platformLabel?: string | null
  segments: readonly SpeechCutMetadataSegment[]
  startSeconds: number
  endSeconds: number
}): Promise<SpeechCutMetadataSuggestion> => {
  const fallback = buildSpeechCutFallbackMetadata({ speechType, dateLabel, summary, source })
  if (!process.env.DEEPSEEK_API_KEY) return { ...fallback, source: 'fallback' }

  const excerpt = excerptOf(segments, startSeconds, endSeconds)
  if (excerpt === '') return { ...fallback, source: 'fallback' }

  try {
    const { object } = await generateObject({
      model: deepSeek('deepseek-flash'),
      schema: suggestionSchema,
      system: source === 'web' ? WEB_SYSTEM_PROMPT : SYSTEM_PROMPT,
      prompt:
        source === 'web'
          ? promptFrom([
              speechTitle?.trim() ? `Título: ${speechTitle.trim()}` : null,
              platformLabel?.trim() ? `Plataforma: ${platformLabel.trim()}` : null,
              `Data: ${dateLabel}`,
              `Trecho (transcrição automática): "${excerpt}"`,
            ])
          : promptFrom([
              `Tipo: ${speechType?.trim() || 'fala'}`,
              `Data: ${dateLabel}`,
              summary?.trim() ? `Resumo oficial: ${summary.trim()}` : null,
              `Trecho (transcrição automática): "${excerpt}"`,
            ]),
      temperature: 0.3,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: AbortSignal.timeout(SUGGESTION_TIMEOUT_MS),
    })

    const title = clipSpeechCutText(object.title, MAX_TITLE_LENGTH)
    const description = clipSpeechCutText(object.description, MAX_DESCRIPTION_LENGTH)
    if (title === '' || description === '') return { ...fallback, source: 'fallback' }
    return { title, description, source: 'ai' }
  } catch {
    return { ...fallback, source: 'fallback' }
  }
}
