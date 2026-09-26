import 'server-only'

import type { Payload } from 'payload'

import {
  pickBestSemanticChunk,
  rankSemanticHits,
  sortSemanticHits,
  speechTextWindows,
  type SpeechSemanticHit,
  type SpeechSemanticSort,
  type SpeechSemanticVector,
} from '@/lib/speechSemantic'
import type { CampaignUser } from '@/payload-types'
import { DEEPINFRA_EMBED_MODEL } from '@/utilities/ai/deepInfraEmbed'
import { buildSpeechFacetWhere } from '@/utilities/speech/speechListFilters'
import type { SpeechListState } from '@/utilities/speech/speechListUrl'
import type {
  SpeechSegmentRecordWithOrder,
  SpeechSemanticEvidence,
} from '@/utilities/speech/speechViewModels'

/**
 * C229 — the semantic path of the acervo list. The candidates are the speeches
 * the facets allow (never the `q` LIKE branches) and the ranking runs in memory
 * over the stored `kind: 'speech'` vectors; the page's evidence comes from the
 * `segment`/`window` rows, loaded only for the current page. Every read goes
 * through the Payload access layer (`user` + `overrideAccess: false`); the
 * loader owns the threshold/ordering and the honest degradation.
 */

export type SpeechMeaningSearchResult = {
  /** Ranked hits (threshold applied), already in the requested order. */
  hits: SpeechSemanticHit[]
  /** Facet-allowed speeches before the ranking. */
  candidates: number
  /** Candidates with a comparable speech-level vector — zero degrades. */
  indexedCandidates: number
}

/** Theme mode has no explicit order: relevance is the default (C229/D5). */
const semanticSortOf = (state: SpeechListState): SpeechSemanticSort => state.sort ?? 'relevancia'

const numberVector = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null
  if (!value.every((item) => typeof item === 'number' && Number.isFinite(item))) return null
  return value as number[]
}

/** The index row as this module selects it (never the whole document). */
type EmbeddingRow = {
  id: number
  speech: number | { id: number } | null
  kind?: 'speech' | 'segment' | 'window' | null
  order?: number | null
  vector?: unknown
}

const speechIdOf = (row: EmbeddingRow): number | null => {
  const speech = row.speech
  if (typeof speech === 'number') return speech
  if (speech && typeof speech === 'object' && typeof speech.id === 'number') return speech.id
  return null
}

/** Facet-filtered candidates + the speech-level vectors + the in-memory rank. */
export const searchSpeechesByMeaning = async (
  payload: Payload,
  user: CampaignUser,
  state: SpeechListState,
  queryVector: SpeechSemanticVector,
): Promise<SpeechMeaningSearchResult> => {
  const candidates = await payload.find({
    collection: 'speech',
    where: { and: buildSpeechFacetWhere(state) },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { speechAt: true, durationSeconds: true },
    user,
    overrideAccess: false,
  })
  if (candidates.docs.length === 0) return { hits: [], candidates: 0, indexedCandidates: 0 }

  const embeddings = await payload.find({
    collection: 'speechEmbedding',
    where: {
      and: [
        { kind: { equals: 'speech' } },
        // Only the current model: a stale vector from another embedding space
        // must never be scored against the query (the loader degrades instead).
        { model: { equals: DEEPINFRA_EMBED_MODEL } },
        { speech: { in: candidates.docs.map((doc) => doc.id) } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { speech: true, vector: true },
    user,
    overrideAccess: false,
  })

  const vectorBySpeech = new Map<number, number[]>()
  for (const row of embeddings.docs) {
    const speechId = speechIdOf(row)
    const vector = numberVector(row.vector)
    if (speechId === null || !vector || vector.length !== queryVector.length) continue
    vectorBySpeech.set(speechId, vector)
  }

  const hits = rankSemanticHits(
    queryVector,
    candidates.docs.map((doc) => ({
      id: doc.id,
      speechAt: doc.speechAt,
      durationSeconds: doc.durationSeconds ?? null,
      vector: vectorBySpeech.get(doc.id) ?? null,
    })),
  )

  return {
    hits: sortSemanticHits(hits, semanticSortOf(state)),
    candidates: candidates.docs.length,
    indexedCandidates: vectorBySpeech.size,
  }
}

/**
 * Resolves the real passage of one stored unit. A segment row points at the ASR
 * segment by `order` (the collection's own ordinal); a window row is recomputed
 * with the SAME pure splitter the index used, over the same source text. Both
 * fall back to the first unit when the stored reference is gone (a re-import
 * that changed the units is the reindex trigger).
 */
const resolveUnitText = (
  row: EmbeddingRow,
  segments: readonly SpeechSegmentRecordWithOrder[],
  sourceText: string | null,
): { text: string; startSeconds: number | null } | null => {
  if (row.kind === 'segment') {
    const segment = segments.find((item) => item.order === row.order) ?? segments[0]
    if (!segment) return null
    return { text: segment.text, startSeconds: segment.startSeconds }
  }

  if (row.kind === 'window') {
    if (!sourceText) return null
    const windows = speechTextWindows(sourceText)
    const window =
      (typeof row.order === 'number' ? windows[row.order] : undefined) ?? windows[0] ?? null
    return window ? { text: window.text, startSeconds: null } : null
  }

  return null
}

/**
 * The evidence of the current page: for each speech, the stored unit closest to
 * the query. Speeches without a usable unit are simply absent from the map (the
 * view model falls back to the lexical excerpt).
 */
export const loadSpeechSemanticEvidence = async (
  payload: Payload,
  user: CampaignUser,
  queryVector: SpeechSemanticVector,
  speechIds: readonly number[],
  segmentsBySpeech: ReadonlyMap<number, readonly SpeechSegmentRecordWithOrder[]>,
  sourceTextBySpeech: ReadonlyMap<number, string | null>,
): Promise<Map<number, SpeechSemanticEvidence>> => {
  const evidence = new Map<number, SpeechSemanticEvidence>()
  if (speechIds.length === 0) return evidence

  const rows = await payload.find({
    collection: 'speechEmbedding',
    where: {
      and: [
        { kind: { in: ['segment', 'window'] } },
        // Same embedding space only (see `searchSpeechesByMeaning`).
        { model: { equals: DEEPINFRA_EMBED_MODEL } },
        { speech: { in: [...speechIds] } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'order',
    select: { speech: true, kind: true, order: true, vector: true },
    user,
    overrideAccess: false,
  })

  const rowsBySpeech = new Map<number, EmbeddingRow[]>()
  for (const row of rows.docs) {
    const speechId = speechIdOf(row)
    if (speechId === null) continue
    const list = rowsBySpeech.get(speechId) ?? []
    list.push(row)
    rowsBySpeech.set(speechId, list)
  }

  for (const speechId of speechIds) {
    const speechRows = rowsBySpeech.get(speechId) ?? []
    const best = pickBestSemanticChunk(
      queryVector,
      speechRows.flatMap((row) => {
        const vector = numberVector(row.vector)
        if (!vector || vector.length !== queryVector.length) return []
        return [{ key: row.id, vector }]
      }),
    )
    if (!best) continue

    const row = speechRows.find((candidate) => candidate.id === best.key)
    if (!row) continue
    const resolved = resolveUnitText(
      row,
      segmentsBySpeech.get(speechId) ?? [],
      sourceTextBySpeech.get(speechId) ?? null,
    )
    if (resolved) evidence.set(speechId, resolved)
  }

  return evidence
}
