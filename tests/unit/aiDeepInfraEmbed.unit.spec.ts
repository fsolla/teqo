import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEEPINFRA_EMBED_DIMENSIONS,
  DEEPINFRA_EMBED_MODEL,
  DEEPINFRA_EMBED_URL,
  EMBED_BATCH_SIZE,
  EMBED_TEXT_MAX_CHARS,
  embedSpeechQuery,
  embedSpeechTexts,
} from '@/utilities/ai/deepInfraEmbed'

/**
 * C229 — the embeddings seam with `fetch` stubbed: the body carries the model
 * and the batched input, the key never rides the URL, every failure degrades to
 * `null` instead of throwing, and the vectors come back L2-normalized in input
 * order.
 */

const fetchMock = vi.fn()

const vector = (head: number[]): number[] => [
  ...head,
  ...new Array(DEEPINFRA_EMBED_DIMENSIONS - head.length).fill(0),
]

const jsonResponse = (payload: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => payload }) as Response

const embeddingResponse = (vectors: number[][], promptTokens = 7) =>
  jsonResponse({
    data: vectors.map((embedding, index) => ({ index, embedding })),
    usage: { prompt_tokens: promptTokens },
  })

const stubFetch = (...responses: Response[]) => {
  fetchMock.mockReset()
  for (const response of responses) fetchMock.mockResolvedValueOnce(response)
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => {
  process.env.DEEPINFRA_API_KEY = 'test-deepinfra-key'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  delete process.env.DEEPINFRA_API_KEY
  vi.unstubAllGlobals()
})

describe('embedSpeechTexts', () => {
  it('posts the model and the batched input with the bearer key', async () => {
    stubFetch(embeddingResponse([vector([3, 4])]))

    const result = await embedSpeechTexts(['fala sobre o SUS'])

    expect(result?.vectors).toEqual([vector([0.6, 0.8])])
    expect(result?.promptTokens).toBe(7)
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe(DEEPINFRA_EMBED_URL)
    expect(url).not.toContain('test-deepinfra-key')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body) as Record<string, unknown>
    expect(body.model).toBe(DEEPINFRA_EMBED_MODEL)
    expect(body.input).toEqual(['fala sobre o SUS'])
    expect(body.encoding_format).toBe('float')
  })

  it('returns an empty result without calling the provider', async () => {
    const result = await embedSpeechTexts([])

    expect(result).toEqual({ vectors: [], promptTokens: 0 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails closed when the key is missing', async () => {
    delete process.env.DEEPINFRA_API_KEY

    await expect(embedSpeechTexts(['fala'])).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the input order when the provider answers out of order', async () => {
    stubFetch(
      jsonResponse({
        data: [
          { index: 1, embedding: vector([0, 1]) },
          { index: 0, embedding: vector([1, 0]) },
        ],
      }),
    )

    const result = await embedSpeechTexts(['primeira', 'segunda'])

    expect(result?.vectors).toEqual([vector([1, 0]), vector([0, 1])])
  })

  it('splits more than the batch size into sequential calls', async () => {
    const texts = new Array(EMBED_BATCH_SIZE + 1).fill('fala')
    stubFetch(
      embeddingResponse(texts.slice(0, EMBED_BATCH_SIZE).map(() => vector([1]))),
      embeddingResponse([vector([1])]),
    )

    const result = await embedSpeechTexts(texts)

    expect(result?.vectors).toHaveLength(EMBED_BATCH_SIZE + 1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const second = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body) as {
      input: string[]
    }
    expect(second.input).toHaveLength(1)
  })

  it('truncates each text to the cost guard', async () => {
    stubFetch(embeddingResponse([vector([1])]))

    await embedSpeechTexts(['x'.repeat(EMBED_TEXT_MAX_CHARS + 500)])

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      input: string[]
    }
    expect(body.input[0]).toHaveLength(EMBED_TEXT_MAX_CHARS)
  })

  it('rejects a wrong dimension, a non-finite value and a broken shape', async () => {
    stubFetch(jsonResponse({ data: [{ index: 0, embedding: [1, 0] }] }))
    await expect(embedSpeechTexts(['fala'])).resolves.toBeNull()

    stubFetch(
      jsonResponse({
        data: [{ index: 0, embedding: vector([1]).map((v, i) => (i === 0 ? Number.NaN : v)) }],
      }),
    )
    await expect(embedSpeechTexts(['fala'])).resolves.toBeNull()

    // Same length as the input, but the second answer repeats index 0: the
    // missing index must fail the batch (never a silent mix-up).
    stubFetch(
      jsonResponse({
        data: [
          { index: 0, embedding: vector([1]) },
          { index: 0, embedding: vector([1]) },
        ],
      }),
    )
    await expect(embedSpeechTexts(['um', 'dois'])).resolves.toBeNull()
  })

  it('maps an HTTP error and a thrown call to null', async () => {
    stubFetch(jsonResponse({ error: 'boom' }, 500))
    await expect(embedSpeechTexts(['fala'])).resolves.toBeNull()

    fetchMock.mockReset()
    fetchMock.mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(embedSpeechTexts(['fala'])).resolves.toBeNull()
  })
})

describe('embedSpeechQuery', () => {
  it('embeds a single trimmed query', async () => {
    stubFetch(embeddingResponse([vector([1])]))

    await expect(embedSpeechQuery('  combate à oposição  ')).resolves.toEqual(vector([1]))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      input: string[]
    }
    expect(body.input).toEqual(['combate à oposição'])
  })

  it('fails closed on a blank query and on a missing key', async () => {
    await expect(embedSpeechQuery('   ')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    delete process.env.DEEPINFRA_API_KEY
    await expect(embedSpeechQuery('impeachment')).resolves.toBeNull()
  })
})
