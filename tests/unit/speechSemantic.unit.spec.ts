// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  cosineSimilarity,
  dotProduct,
  meanPoolVectors,
  normalizeVector,
  pickBestSemanticChunk,
  planSpeechIndex,
  rankSemanticHits,
  sortSemanticHits,
  SPEECH_SEMANTIC_MIN_COSINE,
  speechEmbeddingHash,
  speechSemanticSourceText,
  speechTextWindows,
  type SpeechSemanticCandidate,
  type SpeechSemanticHit,
} from '@/lib/speechSemantic'

// C229 — the pure engine of the semantic acervo: vector math, text windows,
// the content hash and the ranking rules (threshold + relevance default with
// the explicit order overriding it). No network and no Payload here.

describe('vector math', () => {
  it('computes the dot product and rejects mismatched dimensions', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32)
    expect(dotProduct([1, 2], [1])).toBe(0)
  })

  it('normalizes to unit length and keeps a zero vector finite', () => {
    expect(normalizeVector([3, 4])).toEqual([0.6, 0.8])
    expect(normalizeVector([0, 0])).toEqual([0, 0])
  })

  it('computes a real cosine regardless of scale', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
    expect(cosineSimilarity([2, 0], [7, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 2], [1])).toBe(0)
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)
  })

  it('pools vectors by the normalized mean and skips unusable shapes', () => {
    expect(
      meanPoolVectors([
        [1, 0],
        [1, 0],
      ]),
    ).toEqual([1, 0])
    // The mean of opposite directions is the zero vector, never NaN.
    expect(
      meanPoolVectors([
        [1, 0],
        [-1, 0],
      ]),
    ).toEqual([0, 0])
    expect(
      meanPoolVectors([
        [1, 0],
        [0, 1, 0],
      ]),
    ).toEqual([1, 0])
    expect(meanPoolVectors([])).toEqual([])
  })
})

describe('speechTextWindows', () => {
  const longText = 'palavra '.repeat(400).trim()

  it('keeps a short text as a single window', () => {
    expect(speechTextWindows('fala curta')).toEqual([
      { order: 0, start: 0, end: 10, text: 'fala curta' },
    ])
    expect(speechTextWindows('')).toEqual([])
  })

  it('splits long text into ordered overlapping windows without cutting words', () => {
    const windows = speechTextWindows(longText, { size: 100, overlap: 20 })

    expect(windows.length).toBeGreaterThan(2)
    expect(windows.map((window) => window.order)).toEqual(windows.map((_, index) => index))
    for (const window of windows) {
      expect(window.text.length).toBeLessThanOrEqual(100)
      expect(window.text).toBe(window.text.trim())
      // No window starts or ends mid-word: the slice boundaries are word edges.
      expect(longText.slice(window.start, window.end)).toBe(
        `${longText.slice(window.start, window.end).trim()}`,
      )
    }
    // Overlap: the next window starts before the previous one ended.
    expect(windows[1].start).toBeLessThan(windows[0].end)
    // Full coverage: every character of the text belongs to some window.
    let covered = 0
    for (const window of windows) covered = Math.max(covered, window.end)
    expect(covered).toBe(longText.length)
  })
})

describe('speechEmbeddingHash', () => {
  it('is deterministic, text-sensitive and model-sensitive', () => {
    expect(speechEmbeddingHash('fala', 'bge')).toBe(speechEmbeddingHash('fala', 'bge'))
    expect(speechEmbeddingHash('fala', 'bge')).not.toBe(speechEmbeddingHash('outra', 'bge'))
    expect(speechEmbeddingHash('fala', 'bge')).not.toBe(speechEmbeddingHash('fala', 'outro'))
  })
})

describe('rankSemanticHits', () => {
  const candidates: SpeechSemanticCandidate[] = [
    { id: 1, speechAt: '2026-01-01T10:00', vector: [1, 0] }, // 1.0
    { id: 2, speechAt: '2026-02-01T10:00', vector: [0.8, 0.6] }, // 0.8
    { id: 3, speechAt: '2026-03-01T10:00', vector: [0.8, 0.6] }, // 0.8, newer wins the tie
    { id: 4, speechAt: '2026-04-01T10:00', vector: [0, 1] }, // 0.0 (below the cut-off)
    { id: 5, speechAt: '2026-05-01T10:00', vector: null },
    { id: 6, speechAt: '2026-06-01T10:00', vector: [1, 0, 0] },
    { id: 7, speechAt: '2026-07-01T10:00', vector: [0.4, 0.916515] }, // ~0.4 (boundary, kept)
  ]
  const query = [1, 0]

  it('drops unusable candidates and the scores below the cut-off', () => {
    const hits = rankSemanticHits(query, candidates)
    expect(hits.map((hit) => hit.id)).toEqual([1, 3, 2, 7])
  })

  it('sorts by score desc with the date as tiebreak and keeps the duration', () => {
    const hits = rankSemanticHits(query, [
      { id: 9, speechAt: '2026-01-01T10:00', durationSeconds: 120, vector: [1, 0] },
      { id: 8, speechAt: '2026-01-01T10:00', durationSeconds: null, vector: [1, 0] },
    ])
    expect(hits.map((hit) => hit.id)).toEqual([8, 9])
    expect(hits[0]).toMatchObject({ durationSeconds: null, score: 1 })
    expect(hits[1]).toMatchObject({ durationSeconds: 120 })
  })

  it('honors a custom cut-off', () => {
    expect(rankSemanticHits(query, candidates, { minScore: 0.9 }).map((hit) => hit.id)).toEqual([1])
    expect(
      rankSemanticHits([1, 0], [{ id: 1, speechAt: 'x', vector: [1, 0] }], { minScore: 0.95 }),
    ).toHaveLength(1)
  })

  it('keeps the documented default cut-off', () => {
    expect(SPEECH_SEMANTIC_MIN_COSINE).toBe(0.4)
  })
})

describe('sortSemanticHits', () => {
  const hits: SpeechSemanticHit[] = [
    { id: 1, speechAt: '2026-01-01T10:00', durationSeconds: 600, score: 0.9 },
    { id: 3, speechAt: '2026-02-01T10:00', durationSeconds: null, score: 0.7 },
    { id: 2, speechAt: '2026-03-01T10:00', durationSeconds: 120, score: 0.5 },
  ]

  it('keeps the relevance order by default', () => {
    expect(sortSemanticHits(hits, 'relevancia').map((hit) => hit.id)).toEqual([1, 3, 2])
  })

  it('orders by date when the user asks for recentes', () => {
    expect(sortSemanticHits(hits, 'recentes').map((hit) => hit.id)).toEqual([2, 3, 1])
  })

  it('orders by duration in both directions', () => {
    expect(sortSemanticHits(hits, 'duracao_maior').map((hit) => hit.id)).toEqual([1, 2, 3])
    expect(sortSemanticHits(hits, 'duracao_menor').map((hit) => hit.id)).toEqual([2, 1, 3])
  })
})

describe('pickBestSemanticChunk', () => {
  it('picks the closest usable chunk and breaks ties by the lowest key', () => {
    expect(
      pickBestSemanticChunk(
        [1, 0],
        [
          { key: 20, vector: [0, 1] },
          { key: 10, vector: [1, 0] },
          { key: 30, vector: [1, 0] },
        ],
      ),
    ).toEqual({ key: 10, score: 1 })
  })

  it('returns null when no chunk can be compared', () => {
    expect(pickBestSemanticChunk([1, 0], [])).toBeNull()
    expect(pickBestSemanticChunk([1, 0], [{ key: 1, vector: null }])).toBeNull()
    expect(pickBestSemanticChunk([1, 0], [{ key: 1, vector: [1, 0, 0] }])).toBeNull()
  })
})

describe('speechSemanticSourceText', () => {
  it('prefers the official transcript, then the summary, then the search text', () => {
    expect(
      speechSemanticSourceText({
        officialTranscript: 'Transcrição',
        summary: 'Resumo',
        searchText: 'busca',
      }),
    ).toBe('Transcrição')
    expect(speechSemanticSourceText({ officialTranscript: '  ', summary: 'Resumo' })).toBe('Resumo')
    expect(speechSemanticSourceText({ searchText: 'busca' })).toBe('busca')
    expect(speechSemanticSourceText({})).toBeNull()
  })
})

describe('planSpeechIndex', () => {
  const model = 'test-model'

  it('indexes the ASR segments by their own order and skips blanks', () => {
    const plan = planSpeechIndex(
      {
        segments: [
          { order: 1, startSeconds: 0, text: 'Primeiro trecho' },
          { order: 2, startSeconds: 3, text: '   ' },
          { order: 3, startSeconds: 6, text: 'Terceiro trecho' },
        ],
      },
      { model },
    )

    expect(plan?.units).toEqual([
      { kind: 'segment', order: 1, startSeconds: 0, text: 'Primeiro trecho' },
      { kind: 'segment', order: 3, startSeconds: 6, text: 'Terceiro trecho' },
    ])
    expect(plan?.speechHash).toBe(
      speechEmbeddingHash('segment:1:Primeiro trecho\nsegment:3:Terceiro trecho', model),
    )
  })

  it('falls back to text windows when the speech has no segments', () => {
    const plan = planSpeechIndex({ officialTranscript: 'fala '.repeat(400) }, { model })

    expect(plan?.units.length).toBeGreaterThan(1)
    expect(plan?.units.every((unit) => unit.kind === 'window')).toBe(true)
    expect(plan?.units[0]).toMatchObject({ order: 0, startSeconds: null })
  })

  it('returns null without any usable text', () => {
    expect(planSpeechIndex({ segments: [] }, { model })).toBeNull()
    expect(planSpeechIndex({ officialTranscript: '  ', summary: null }, { model })).toBeNull()
  })

  it('changes the hash with the model so a model swap reindexes', () => {
    const speech = { segments: [{ order: 1, startSeconds: 0, text: 'Fala' }] }
    expect(planSpeechIndex(speech, { model: 'a' })?.speechHash).not.toBe(
      planSpeechIndex(speech, { model: 'b' })?.speechHash,
    )
  })
})
