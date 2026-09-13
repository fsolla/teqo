import 'server-only'

import { z } from 'zod'

import {
  mergeFacetClassification,
  parseLlmFacetResponse,
  SPEECH_SCOPES,
  SPEECH_TOPICS,
  type MergedSpeechFacets,
} from '@/lib/speechFacets'
import { classifySpeechByGazetteer, type SpeechFacetInput } from '@/lib/speechGazetteer'

/**
 * Facet classification for one speech (C153): the offline gazetteer pass plus
 * one LLM refinement on Deep Infra (same key/provider as the ASR). The LLM
 * output is validated against the taxonomy; any failure — missing key, HTTP
 * error, timeout, invalid JSON — degrades to the gazetteer provenance and
 * never throws, so the import continues.
 */

const DEEPINFRA_CHAT_URL = 'https://api.deepinfra.com/v1/openai/chat/completions'
const DEEPINFRA_FACET_MODEL = 'deepseek-ai/DeepSeek-V4-Flash'
const FACET_TIMEOUT_MS = 60_000
const TRANSCRIPT_PROMPT_LIMIT = 12_000

export type SpeechClassificationResult = {
  facets: MergedSpeechFacets
  llm: {
    used: boolean
    totalTokens: number | null
    estimatedCostUsd: number | null
    error: string | null
  }
}

const TOPIC_PROMPT_VALUES = SPEECH_TOPICS.map(({ value, label }) => `${value} (${label})`).join(
  '; ',
)
const SCOPE_PROMPT_VALUES = SPEECH_SCOPES.map(({ value, label }) => `${value} (${label})`).join(
  '; ',
)

const FACET_SYSTEM_PROMPT = [
  'Você classifica discursos do deputado federal Jorge Solla (PT-BA) para um catálogo de falas.',
  'Responda SOMENTE com um JSON válido, sem markdown, no formato:',
  '{"topics": [], "scopes": [], "people": [], "programs": [], "projects": []}',
  `topics: subconjunto de [${TOPIC_PROMPT_VALUES}] — use exatamente esses valores.`,
  `scopes: subconjunto de [${SCOPE_PROMPT_VALUES}] — use exatamente esses valores.`,
  'people: pessoas citadas, nome completo quando houver (máx. 12).',
  'programs: programas de governo citados (ex.: "Minha Casa, Minha Vida").',
  'projects: proposições citadas (PL, PEC, medida provisória), com o número quando houver.',
  'Não invente: liste apenas o que aparece no sumário, nas palavras-chave ou na transcrição.',
  'Máximo 4 topics. Sem conteúdo em uma lista, devolva [].',
].join('\n')

const llmEnvelopeSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }).passthrough() })).min(1),
  usage: z
    .object({
      total_tokens: z.number().optional(),
      estimated_cost: z.number().optional(),
    })
    .optional(),
})

const buildUserPrompt = (input: SpeechFacetInput): string => {
  const transcript = input.transcript.slice(0, TRANSCRIPT_PROMPT_LIMIT)
  return [
    `SUMÁRIO: ${input.summary ?? '—'}`,
    `PALAVRAS-CHAVE OFICIAIS: ${input.keywords?.join('; ') ?? '—'}`,
    `TRANSCRIÇÃO (trecho): ${transcript}`,
  ].join('\n')
}

export const classifySpeech = async (
  input: SpeechFacetInput,
): Promise<SpeechClassificationResult> => {
  const gazetteer = classifySpeechByGazetteer(input)
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    return {
      facets: mergeFacetClassification(gazetteer, null),
      llm: { used: false, totalTokens: null, estimatedCostUsd: null, error: 'chave ausente' },
    }
  }

  try {
    const response = await fetch(DEEPINFRA_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPINFRA_FACET_MODEL,
        messages: [
          { role: 'system', content: FACET_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(input) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(FACET_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const envelope = llmEnvelopeSchema.safeParse(await response.json())
    if (!envelope.success) throw new Error('resposta do provedor fora do formato')
    const parsed = parseLlmFacetResponse(JSON.parse(envelope.data.choices[0].message.content))
    if (!parsed) throw new Error('resposta fora da taxonomia')

    return {
      facets: mergeFacetClassification(gazetteer, parsed),
      llm: {
        used: true,
        totalTokens: envelope.data.usage?.total_tokens ?? null,
        estimatedCostUsd: envelope.data.usage?.estimated_cost ?? null,
        error: null,
      },
    }
  } catch (error) {
    return {
      facets: mergeFacetClassification(gazetteer, null),
      llm: {
        used: false,
        totalTokens: null,
        estimatedCostUsd: null,
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
