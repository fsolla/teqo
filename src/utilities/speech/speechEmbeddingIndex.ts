import 'server-only'

import type { Payload } from 'payload'

import {
  cosineSimilarity,
  meanPoolVectors,
  planSpeechIndex,
  type SpeechIndexPlan,
  type SpeechIndexSegment,
} from '@/lib/speechSemantic'
import { DEEPINFRA_EMBED_MODEL, embedSpeechTexts } from '@/utilities/ai/deepInfraEmbed'
import { withPayloadTransaction } from '@/utilities/payloadTransaction'

/**
 * C229 — the index owner: plans the retrieval units of a speech (pure), embeds
 * the stale ones in one provider call and replaces the rows in a transaction.
 * The CLI is the only production caller (a trusted actor, `overrideAccess:
 * true`); the loader only reads. Idempotent by the speech-level `contentHash`
 * (unit texts + model), so a re-run after an import only pays for what changed.
 */

export type SpeechIndexSource = {
  id: number
  officialTranscript?: string | null
  summary?: string | null
  searchText?: string | null
  segments: readonly SpeechIndexSegment[]
}

type PlannedSpeechIndex = {
  source: SpeechIndexSource
  plan: SpeechIndexPlan
}

export type SpeechIndexPlanBatch = {
  /** Speeches whose units must be embedded (hash/model changed). */
  stale: PlannedSpeechIndex[]
  /** Speech-level hash already matches the plan. */
  upToDate: number
  /** No usable text at all. */
  skippedNoText: number
  units: number
}

export type SpeechIndexBatchResult = {
  indexed: number
  upToDate: number
  skippedNoText: number
  failed: number
  units: number
  promptTokens: number
}

export type SpeechIndexPlanDeps = {
  force?: boolean
}

export type SpeechIndexDeps = SpeechIndexPlanDeps & {
  embedTexts?: typeof embedSpeechTexts
}

/** Stored speech-level hashes of the given speeches (the skip key). */
const loadStoredSpeechHashes = async (
  payload: Payload,
  speechIds: readonly number[],
): Promise<Map<number, string>> => {
  const stored = new Map<number, string>()
  if (speechIds.length === 0) return stored

  const result = await payload.find({
    collection: 'speechEmbedding',
    where: { and: [{ kind: { equals: 'speech' } }, { speech: { in: [...speechIds] } }] },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { speech: true, contentHash: true },
    // Intentional bypass: the index CLI is a trusted actor with no session.
    overrideAccess: true,
  })

  for (const row of result.docs) {
    const speech = row.speech
    const speechId = typeof speech === 'number' ? speech : (speech?.id ?? null)
    if (typeof speechId === 'number' && row.contentHash) stored.set(speechId, row.contentHash)
  }
  return stored
}

/** Plans a batch and separates what must be embedded from what is current. */
export const planSpeechIndexBatch = async (
  payload: Payload,
  sources: readonly SpeechIndexSource[],
  { force = false }: SpeechIndexPlanDeps = {},
): Promise<SpeechIndexPlanBatch> => {
  const planned: PlannedSpeechIndex[] = []
  let skippedNoText = 0

  for (const source of sources) {
    const plan = planSpeechIndex(source, { model: DEEPINFRA_EMBED_MODEL })
    if (!plan) {
      skippedNoText += 1
      continue
    }
    planned.push({ source, plan })
  }

  const storedHashes = force
    ? new Map<number, string>()
    : await loadStoredSpeechHashes(
        payload,
        planned.map(({ source }) => source.id),
      )

  const stale = planned.filter(
    ({ source, plan }) => storedHashes.get(source.id) !== plan.speechHash,
  )
  return {
    stale,
    upToDate: planned.length - stale.length,
    skippedNoText,
    units: stale.reduce((total, { plan }) => total + plan.units.length, 0),
  }
}

/**
 * Embeds and persists the stale speeches of a batch. The provider call is ONE
 * ordered sequence for the whole batch: a provider failure writes nothing.
 * Persistence is per speech (one transaction each), so a database failure
 * mid-batch can leave the earlier speeches indexed — `failed` reports it
 * honestly and the next run only pays for the rest.
 */
export const indexSpeechSources = async (
  payload: Payload,
  sources: readonly SpeechIndexSource[],
  deps: SpeechIndexDeps = {},
): Promise<SpeechIndexBatchResult> => {
  const { embedTexts = embedSpeechTexts, force = false } = deps
  const batch = await planSpeechIndexBatch(payload, sources, { force })
  const base = {
    upToDate: batch.upToDate,
    skippedNoText: batch.skippedNoText,
    units: 0,
    promptTokens: 0,
  }
  if (batch.stale.length === 0) return { ...base, indexed: 0, failed: 0 }

  const texts = batch.stale.flatMap(({ plan }) => plan.units.map((unit) => unit.text))
  const embedded = await embedTexts(texts)
  if (!embedded) {
    return { ...base, indexed: 0, failed: batch.stale.length }
  }
  // The whole batch was embedded already: the tokens were spent even if a
  // later write fails.
  const spent = { units: texts.length, promptTokens: embedded.promptTokens }

  let cursor = 0
  let indexed = 0
  for (const { source, plan } of batch.stale) {
    const vectors = embedded.vectors.slice(cursor, cursor + plan.units.length)
    cursor += plan.units.length
    if (vectors.length !== plan.units.length) {
      return { ...base, ...spent, indexed, failed: batch.stale.length - indexed }
    }

    const speechVector = meanPoolVectors(vectors)
    await withPayloadTransaction(payload, async ({ req }) => {
      await payload.delete({
        collection: 'speechEmbedding',
        where: { speech: { equals: source.id } },
        req,
        // Intentional bypass: rebuilding the derived index of a trusted run.
        overrideAccess: true,
      })
      await payload.create({
        collection: 'speechEmbedding',
        data: {
          speech: source.id,
          kind: 'speech',
          model: DEEPINFRA_EMBED_MODEL,
          dimensions: speechVector.length,
          contentHash: plan.speechHash,
          vector: Array.from(speechVector),
        },
        req,
        // Intentional bypass: same trusted rebuild.
        overrideAccess: true,
      })
      for (const [index, unit] of plan.units.entries()) {
        const vector = vectors[index]
        if (!vector) continue
        await payload.create({
          collection: 'speechEmbedding',
          data: {
            speech: source.id,
            kind: unit.kind,
            order: unit.order,
            startSeconds: unit.startSeconds,
            model: DEEPINFRA_EMBED_MODEL,
            dimensions: vector.length,
            contentHash: `${plan.speechHash}#${unit.kind}:${unit.order}`,
            vector: Array.from(vector),
          },
          req,
          // Intentional bypass: same trusted rebuild.
          overrideAccess: true,
        })
      }
    })
    indexed += 1
  }

  return {
    upToDate: base.upToDate,
    skippedNoText: base.skippedNoText,
    indexed,
    failed: batch.stale.length - indexed,
    ...spent,
  }
}

export type SpeechIndexProbeHit = {
  id: number
  sourceKey: string
  speechAt: string
  origin: string
  score: number
}

/**
 * Read-only calibration of the theme cut-off: ranks every indexed speech
 * against the query vector (score included) and returns the top N. The score
 * never reaches the UI; this is the CLI-only instrument the runbook uses to
 * verify the acceptance themes and tune `SPEECH_SEMANTIC_MIN_COSINE`.
 */
export const probeSpeechIndex = async (
  payload: Payload,
  queryVector: readonly number[],
  { limit = 10 }: { limit?: number } = {},
): Promise<SpeechIndexProbeHit[]> => {
  const embeddings = await payload.find({
    collection: 'speechEmbedding',
    // Same embedding space as the query: another model's 1024 dims would score
    // nonsense (the collection keeps `model` exactly to denounce that).
    where: { and: [{ kind: { equals: 'speech' } }, { model: { equals: DEEPINFRA_EMBED_MODEL } }] },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { speech: true, vector: true },
    // Intentional bypass: the probe is a trusted read with no session.
    overrideAccess: true,
  })

  const vectorBySpeech = new Map<number, number[]>()
  for (const row of embeddings.docs) {
    const speech = row.speech
    const speechId = typeof speech === 'number' ? speech : (speech?.id ?? null)
    const vector = Array.isArray(row.vector) ? row.vector : null
    if (typeof speechId !== 'number' || !vector || vector.length !== queryVector.length) continue
    if (!vector.every((value) => typeof value === 'number' && Number.isFinite(value))) continue
    vectorBySpeech.set(speechId, vector as number[])
  }
  if (vectorBySpeech.size === 0) return []

  const speeches = await payload.find({
    collection: 'speech',
    where: { id: { in: [...vectorBySpeech.keys()] } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { sourceKey: true, speechAt: true, origin: true },
    // Intentional bypass: same trusted read.
    overrideAccess: true,
  })

  return speeches.docs
    .flatMap((speech) => {
      const vector = vectorBySpeech.get(speech.id)
      if (!vector) return []
      const score = cosineSimilarity(queryVector, vector)
      return [
        {
          id: speech.id,
          sourceKey: speech.sourceKey,
          speechAt: speech.speechAt,
          origin: speech.origin,
          score,
        },
      ]
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, limit))
}

/** Shape shared by the CLI report and the `--dry-run` preview. */
export type SpeechIndexPreview = {
  speeches: number
  upToDate: number
  skippedNoText: number
  toIndex: number
  units: number
}

export const previewSpeechIndex = (
  batch: SpeechIndexPlanBatch,
  speeches: number,
): SpeechIndexPreview => ({
  speeches,
  upToDate: batch.upToDate,
  skippedNoText: batch.skippedNoText,
  toIndex: batch.stale.length,
  units: batch.units,
})
