/**
 * C229 — pure semantic engine of the speech acervo. The index stores
 * L2-normalized vectors per speech and per retrieval unit (ASR segment or text
 * window); this module owns the vector math, the window splitter used when a
 * speech has no segments, the deterministic content hash of the index and the
 * ranking rules (threshold, relevance default, explicit order override). No IO,
 * Payload or Next: the loader and the index CLI share it and the unit tests
 * pin it without a network.
 */

/** The provisional cut-off of the theme mode — calibrated by `acervo:index --probe`. */
export const SPEECH_SEMANTIC_MIN_COSINE = 0.4

/**
 * C237 — weight of the official metadata (summary/title + keywords) against the
 * mean of the spoken units when composing the speech-level vector. Calibrated
 * on the production corpus (2026-09-30): with weight 1 the Dilma impeachment
 * vote speech (222) sat at #25 for the theme "impeachment"; with 2 it reaches
 * the first page (#8) and the topic cluster (2016 process + Bolsonaro requests)
 * leads, without dropping the other acceptance themes out of their cluster.
 */
export const SPEECH_METADATA_VECTOR_WEIGHT = 2

/** Text windows of speeches without ASR segments: ~1200 chars, ~200 of overlap. */
const SPEECH_WINDOW_SIZE_CHARS = 1200
const SPEECH_WINDOW_OVERLAP_CHARS = 200

export type SpeechSemanticVector = readonly number[]

export const dotProduct = (a: SpeechSemanticVector, b: SpeechSemanticVector): number => {
  if (a.length !== b.length) return 0
  let sum = 0
  for (let index = 0; index < a.length; index += 1) sum += a[index] * b[index]
  return sum
}

const vectorNorm = (vector: SpeechSemanticVector): number => Math.sqrt(dotProduct(vector, vector))

/** L2-normalizes; a zero/degenerate vector normalizes to zeros (never NaN). */
export const normalizeVector = (vector: SpeechSemanticVector): number[] => {
  const norm = vectorNorm(vector)
  if (norm === 0) return vector.map(() => 0)
  return vector.map((value) => value / norm)
}

/**
 * Cosine of two vectors. The index normalizes on write, but this stays a real
 * cosine so a non-normalized fixture never turns into a silent dot product.
 */
export const cosineSimilarity = (a: SpeechSemanticVector, b: SpeechSemanticVector): number => {
  if (a.length !== b.length || a.length === 0) return 0
  const normA = vectorNorm(a)
  const normB = vectorNorm(b)
  if (normA === 0 || normB === 0) return 0
  return dotProduct(a, b) / (normA * normB)
}

/** The speech-level vector: element-wise mean of its unit vectors, normalized. */
export const meanPoolVectors = (vectors: readonly SpeechSemanticVector[]): number[] => {
  const usable = vectors.filter((vector) => vector.length > 0)
  if (usable.length === 0) return []
  const dimensions = usable[0].length
  const sums = new Array<number>(dimensions).fill(0)
  let counted = 0
  for (const vector of usable) {
    if (vector.length !== dimensions) continue
    for (let index = 0; index < dimensions; index += 1) sums[index] += vector[index]
    counted += 1
  }
  if (counted === 0) return []
  return normalizeVector(sums.map((sum) => sum / counted))
}

export type SpeechTextWindow = {
  order: number
  start: number
  end: number
  text: string
}

/**
 * Splits a text into overlapping windows without cutting a word in half: the
 * end retreats to the last whitespace inside the window when possible. The
 * SAME function builds the index and re-reads the evidence window, so `order`
 * is stable.
 */
export const speechTextWindows = (
  text: string,
  {
    size = SPEECH_WINDOW_SIZE_CHARS,
    overlap = SPEECH_WINDOW_OVERLAP_CHARS,
  }: { size?: number; overlap?: number } = {},
): SpeechTextWindow[] => {
  if (!Number.isInteger(size) || size <= 0) return []
  const safeOverlap = Math.min(Math.max(overlap, 0), size - 1)
  const windows: SpeechTextWindow[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      const pivot = text.lastIndexOf(' ', end)
      if (pivot > start) end = pivot
    }
    const chunk = text.slice(start, end).trim()
    if (chunk) windows.push({ order: windows.length, start, end, text: chunk })
    if (end >= text.length) break
    start = Math.max(end - safeOverlap, start + 1)
  }
  return windows
}

/**
 * FNV-1a over `model\0text` — the staleness key of one index row. Cheap and
 * deterministic; it only decides whether a re-import must re-embed.
 */
export const speechEmbeddingHash = (text: string, model: string): string => {
  const source = `${model}\u0000${text}`
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export type SpeechSemanticCandidate = {
  id: number
  /** Câmara wall-clock string; the only tiebreak of the relevance order. */
  speechAt: string
  durationSeconds?: number | null
  vector: SpeechSemanticVector | null
}

export type SpeechSemanticHit = {
  id: number
  speechAt: string
  durationSeconds: number | null
  score: number
}

/** Newest first; id breaks exact ties so the order is total and stable. */
const byDateDesc = (a: SpeechSemanticHit, b: SpeechSemanticHit): number =>
  a.speechAt === b.speechAt ? a.id - b.id : a.speechAt < b.speechAt ? 1 : -1

/**
 * Similarity ranking with the honest cut-off: candidates without a usable
 * vector (wrong dimension included) and hits below `minScore` are dropped, the
 * rest sorts by score desc with the date (and then the id) as tiebreak.
 */
export const rankSemanticHits = (
  query: SpeechSemanticVector,
  candidates: readonly SpeechSemanticCandidate[],
  { minScore = SPEECH_SEMANTIC_MIN_COSINE }: { minScore?: number } = {},
): SpeechSemanticHit[] => {
  const hits: SpeechSemanticHit[] = []
  for (const candidate of candidates) {
    if (!candidate.vector || candidate.vector.length !== query.length) continue
    const score = cosineSimilarity(query, candidate.vector)
    if (score < minScore) continue
    hits.push({
      id: candidate.id,
      speechAt: candidate.speechAt,
      durationSeconds: candidate.durationSeconds ?? null,
      score,
    })
  }
  return hits.sort((a, b) => b.score - a.score || byDateDesc(a, b))
}

export type SpeechSemanticSort = 'relevancia' | 'recentes' | 'duracao_maior' | 'duracao_menor'

/**
 * The explicit user order overrides relevance without re-filtering: the hits
 * already passed the threshold, and `Array.sort` is stable, so equal dates or
 * durations keep the relevance order.
 */
export const sortSemanticHits = (
  hits: readonly SpeechSemanticHit[],
  sort: SpeechSemanticSort,
): SpeechSemanticHit[] => {
  const sorted = [...hits]
  switch (sort) {
    case 'recentes':
      return sorted.sort(byDateDesc)
    case 'duracao_maior':
      return sorted.sort(
        (a, b) => (b.durationSeconds ?? -1) - (a.durationSeconds ?? -1) || byDateDesc(a, b),
      )
    case 'duracao_menor':
      return sorted.sort(
        (a, b) =>
          (a.durationSeconds ?? Number.POSITIVE_INFINITY) -
            (b.durationSeconds ?? Number.POSITIVE_INFINITY) || byDateDesc(a, b),
      )
    default:
      return sorted
  }
}

export type SpeechSemanticChunk = {
  /** Stable identity of the row inside its speech (the embedding row id). */
  key: number
  vector: SpeechSemanticVector | null
}

/**
 * The evidence unit of one speech: the chunk closest to the query. `null` when
 * the speech has no usable chunk (the caller falls back to the lexical
 * excerpt). Ties resolve to the lowest key so the card never jumps.
 */
export const pickBestSemanticChunk = (
  query: SpeechSemanticVector,
  chunks: readonly SpeechSemanticChunk[],
): { key: number; score: number } | null => {
  let best: { key: number; score: number } | null = null
  for (const chunk of chunks) {
    if (!chunk.vector || chunk.vector.length !== query.length) continue
    const score = cosineSimilarity(query, chunk.vector)
    if (!best || score > best.score || (score === best.score && chunk.key < best.key)) {
      best = { key: chunk.key, score }
    }
  }
  return best
}

/**
 * The raw text the index and the evidence reader share for speeches without
 * ASR segments: the official transcript first (the real spelling), then the
 * summary, then the normalized search text as the last honest resort.
 */
export const speechSemanticSourceText = (speech: {
  officialTranscript?: string | null
  summary?: string | null
  searchText?: string | null
}): string | null => {
  for (const candidate of [speech.officialTranscript, speech.summary, speech.searchText]) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  return null
}

type SpeechIndexUnit = {
  kind: 'segment' | 'window'
  /** Segment ordinal (the collection's) or the window index. */
  order: number
  startSeconds: number | null
  text: string
}

export type SpeechIndexPlan = {
  units: SpeechIndexUnit[]
  /**
   * C237 — official metadata text folded into the speech-level vector (never
   * stored as a unit, never evidence). `null` when the speech carries none.
   */
  metadataText: string | null
  /** Hash of every unit text + metadata + model: the CLI's skip key. */
  speechHash: string
}

/**
 * C237 — the official metadata of one speech: the Câmara summary (the web title
 * when there is no summary) plus the raw official keywords. This is the text
 * that states the *topic* even when the spoken passage never names it (the
 * impeachment vote speech never says "impeachment").
 */
export const speechMetadataText = (speech: {
  summary?: string | null
  title?: string | null
  keywords?: readonly string[] | null
}): string | null => {
  const head = [speech.summary, speech.title].find(
    (candidate) => typeof candidate === 'string' && candidate.trim() !== '',
  )
  const keywords = (speech.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean)
  const text = [head?.trim() ?? '', keywords.join(', ')].filter(Boolean).join('\n')
  return text === '' ? null : text
}

/**
 * C237 — the speech-level vector of the index: the normalized mean of the unit
 * vectors plus the weighted official metadata. A speech without metadata keeps
 * the pre-C237 mean exactly.
 */
export const composeSpeechVector = (
  unitVectors: readonly SpeechSemanticVector[],
  metadataVector: SpeechSemanticVector | null,
): number[] => {
  const mean = meanPoolVectors(unitVectors)
  if (!metadataVector || metadataVector.length !== mean.length || mean.length === 0) return mean
  return normalizeVector(
    mean.map((value, index) => value + SPEECH_METADATA_VECTOR_WEIGHT * metadataVector[index]),
  )
}

export type SpeechIndexSegment = {
  order: number
  startSeconds: number
  text: string
}

/**
 * The retrieval units of one speech: the ASR segments when they exist, else
 * fixed text windows of the source text. `null` when the speech has no text at
 * all (the caller reports it as skipped). Pure: the index CLI and its tests
 * share it, and the evidence reader re-derives windows with the same splitter.
 */
export const planSpeechIndex = (
  speech: {
    officialTranscript?: string | null
    summary?: string | null
    title?: string | null
    keywords?: readonly string[] | null
    searchText?: string | null
    segments?: readonly SpeechIndexSegment[]
  },
  { model }: { model: string },
): SpeechIndexPlan | null => {
  const units: SpeechIndexUnit[] = []
  const segments = speech.segments ?? []

  if (segments.length > 0) {
    for (const segment of segments) {
      const text = segment.text.trim()
      if (!text) continue
      units.push({
        kind: 'segment',
        order: segment.order,
        startSeconds: segment.startSeconds,
        text,
      })
    }
  } else {
    const sourceText = speechSemanticSourceText(speech)
    if (sourceText) {
      for (const window of speechTextWindows(sourceText)) {
        units.push({ kind: 'window', order: window.order, startSeconds: null, text: window.text })
      }
    }
  }

  if (units.length === 0) return null

  const metadataText = speechMetadataText(speech)
  const speechHash = speechEmbeddingHash(
    [
      ...units.map((unit) => `${unit.kind}:${unit.order}:${unit.text}`),
      ...(metadataText ? [`metadata:${metadataText}`] : []),
    ].join('\n'),
    model,
  )
  return { units, metadataText, speechHash }
}
