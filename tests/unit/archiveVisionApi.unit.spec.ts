// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  ArchiveVisionError,
  analyzeArchivePhotoVision,
} from '../../scripts/lib/archiveVisionApi.mjs'

// C232 — the vision client contract: request shape, auth header, transient
// retry, terminal 4xx, timeout/abort and the named refusals. `fetch` is always
// a fake — the real engine never enters the suite.

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response

const fakeFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) =>
  vi.fn(impl) as unknown as typeof fetch

const call = (fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) =>
  analyzeArchivePhotoVision({
    baseUrl: 'http://100.94.122.26:11434/v1',
    model: 'qwen2.5vl:7b',
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
    prompt: 'descreva a foto',
    systemPrompt: 'responda em JSON',
    fetchImpl,
    retryAttempts: 1,
    sleep: async () => undefined,
    ...overrides,
  })

describe('analyzeArchivePhotoVision (C232)', () => {
  it('refuses to call without the engine config or a prepared image', async () => {
    await expect(
      call(
        fakeFetch(async () => jsonResponse({})),
        { baseUrl: '  ' },
      ),
    ).rejects.toThrow(/ARCHIVE_VISION_BASE_URL/)
    await expect(
      call(
        fakeFetch(async () => jsonResponse({})),
        { model: '' },
      ),
    ).rejects.toThrow(/ARCHIVE_VISION_MODEL/)
    await expect(
      call(
        fakeFetch(async () => jsonResponse({})),
        { imageDataUrl: 'http://x/foto.jpg' },
      ),
    ).rejects.toThrow(/data: URL/)
  })

  it('posts the OpenAI-compatible shape with the image and the key header', async () => {
    const fetchImpl = fakeFetch(async () =>
      jsonResponse({ choices: [{ message: { content: '{"caption":"ok"}' } }] }),
    )

    const content = await call(fetchImpl, { apiKey: 'segredo' })

    expect(content).toBe('{"caption":"ok"}')
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]
    expect(url).toBe('http://100.94.122.26:11434/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer segredo')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('qwen2.5vl:7b')
    expect(body.stream).toBe(false)
    expect(body.messages[0]).toMatchObject({ role: 'system', content: 'responda em JSON' })
    expect(body.messages[1].content[0]).toMatchObject({ type: 'text', text: 'descreva a foto' })
    expect(body.messages[1].content[1]).toMatchObject({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    })
  })

  it('retries a transient 5xx with backoff and succeeds', async () => {
    const sleeps: number[] = []
    let attempts = 0
    const fetchImpl = fakeFetch(async () => {
      attempts += 1
      if (attempts === 1) return jsonResponse({ error: 'sobrecarregado' }, 503)
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] })
    })

    const content = await call(fetchImpl, {
      retryAttempts: 3,
      retryBaseDelayMs: 100,
      sleep: async (ms: number) => {
        sleeps.push(ms)
      },
    })

    expect(content).toBe('ok')
    expect(attempts).toBe(2)
    expect(sleeps).toEqual([100])
  })

  it('does not retry a terminal 4xx refusal and keeps the provider detail', async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse({ error: 'modelo desconhecido' }, 404))

    await expect(call(fetchImpl, { retryAttempts: 3 })).rejects.toMatchObject({
      name: 'ArchiveVisionError',
      status: 404,
      message: expect.stringContaining('modelo desconhecido'),
    })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1)
  })

  it('retries a network failure as transient', async () => {
    let attempts = 0
    const fetchImpl = fakeFetch(async () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('fetch failed')
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] })
    })

    await expect(call(fetchImpl, { retryAttempts: 2 })).resolves.toBe('ok')
    expect(attempts).toBe(2)
  })

  it('names an off-contract answer instead of guessing', async () => {
    await expect(call(fakeFetch(async () => jsonResponse({ choices: [] })))).rejects.toBeInstanceOf(
      ArchiveVisionError,
    )
    await expect(
      call(
        fakeFetch(
          async () =>
            ({
              ok: true,
              status: 200,
              json: async () => {
                throw new Error('html')
              },
            }) as unknown as Response,
        ),
      ),
    ).rejects.toThrow(/não é JSON/)
  })
})
