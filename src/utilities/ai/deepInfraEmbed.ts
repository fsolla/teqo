import 'server-only'

import { normalizeVector, type SpeechSemanticVector } from '@/lib/speechSemantic'

/**
 * C229 — the embeddings network seam of the speech acervo, deliberately the
 * only place the app/index CLI talks to Deep Infra for sense. Same provider and
 * key as the ASR (`deepInfraTranscribe.ts`), OpenAI-compatible endpoint and the
 * same contract: never throws — a missing key, timeout, provider error or
 * malformed output resolves to `null` and the caller degrades honestly.
 *
 * The model is BAAI/bge-m3 (multilingual, 1024 dims, 8192 tokens) at
 * US$0.010/1M tokens (DeepInfra public price, 2026-09-25); the vectors are
 * L2-normalized here so the index and the query share the same scale and the
 * pure ranking can stay a cosine.
 */

export const DEEPINFRA_EMBED_URL = 'https://api.deepinfra.com/v1/openai/embeddings'
export const DEEPINFRA_EMBED_MODEL = 'BAAI/bge-m3'
export const DEEPINFRA_EMBED_DIMENSIONS = 1024
export const DEEPINFRA_EMBED_COST_PER_MILLION_TOKENS_USD = 0.01

/** Cost guard per text: a window is ~1200 chars; anything longer is truncated. */
export const EMBED_TEXT_MAX_CHARS = 2000
export const EMBED_BATCH_SIZE = 32

const EMBED_TIMEOUT_MS = 30_000
const QUERY_TIMEOUT_MS = 8_000

export type SpeechTextsEmbedding = {
  vectors: SpeechSemanticVector[]
  promptTokens: number
}

/** The injectable query boundary (tests pass a deterministic resolver). */
export type SpeechQueryEmbeddingResolver = (query: string) => Promise<SpeechSemanticVector | null>

type EmbedResponse = {
  data?: unknown
  usage?: { prompt_tokens?: unknown }
}

/** Parses one OpenAI-shaped batch and returns the vectors in input order. */
const parseBatch = (
  payload: unknown,
  expected: number,
): { vectors: number[][]; promptTokens: number } | null => {
  const { data, usage } = (payload ?? {}) as EmbedResponse
  if (!Array.isArray(data) || data.length !== expected) return null

  const byIndex = new Array<number[] | null>(expected).fill(null)
  for (const item of data) {
    if (!item || typeof item !== 'object') return null
    const { index, embedding } = item as { index?: unknown; embedding?: unknown }
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= expected) {
      return null
    }
    if (!Array.isArray(embedding) || embedding.length !== DEEPINFRA_EMBED_DIMENSIONS) return null
    if (!embedding.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      return null
    }
    byIndex[index] = embedding as number[]
  }
  if (byIndex.some((vector) => vector === null)) return null

  const promptTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : 0
  return { vectors: byIndex.map((vector) => normalizeVector(vector ?? [])), promptTokens }
}

/**
 * Embeds texts in `EMBED_BATCH_SIZE` batches, in input order. Returns `null`
 * when the mechanism is unavailable or any batch comes back malformed — the
 * index CLI never persists a partial/mixed index from a failed run.
 */
export const embedSpeechTexts = async (
  texts: readonly string[],
  { timeoutMs = EMBED_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<SpeechTextsEmbedding | null> => {
  if (texts.length === 0) return { vectors: [], promptTokens: 0 }

  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) return null

  const batches: string[][] = []
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    batches.push(
      texts
        .slice(start, start + EMBED_BATCH_SIZE)
        .map((text) => text.slice(0, EMBED_TEXT_MAX_CHARS)),
    )
  }

  const vectors: number[][] = []
  let promptTokens = 0
  for (const input of batches) {
    try {
      const response = await fetch(DEEPINFRA_EMBED_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPINFRA_EMBED_MODEL,
          input,
          encoding_format: 'float',
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) return null

      const parsed = parseBatch(await response.json(), input.length)
      if (!parsed) return null
      vectors.push(...parsed.vectors)
      promptTokens += parsed.promptTokens
    } catch {
      return null
    }
  }

  return { vectors, promptTokens }
}

/**
 * The single query embedding of a theme search. A blank query or an
 * unavailable provider resolves to `null` (the loader degrades to the literal
 * search with the discreet notice).
 */
export const embedSpeechQuery: SpeechQueryEmbeddingResolver = async (query) => {
  const trimmed = query.trim()
  if (!trimmed) return null
  const embedded = await embedSpeechTexts([trimmed], { timeoutMs: QUERY_TIMEOUT_MS })
  return embedded?.vectors[0] ?? null
}
