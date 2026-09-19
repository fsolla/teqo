// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ASSEMBLYAI_TRANSCRIPT_URL,
  ASSEMBLYAI_UPLOAD_URL,
  assemblyAiDiarize,
} from '@/utilities/ai/assemblyAiDiarize'

type FetchCall = { url: string; init: RequestInit | undefined }

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status })

const audioBlob = (): Blob => new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' })

const installFetch = (
  handler: (url: string, init: RequestInit | undefined, call: number) => Response,
): FetchCall[] => {
  const calls: FetchCall[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, init })
      return handler(url, init, calls.length)
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('AssemblyAI diarization provider (C200)', () => {
  it('uploads, submits with speaker labels and normalizes ms to seconds', async () => {
    vi.stubEnv('ASSEMBLYAI_API_KEY', 'test-key')
    const calls = installFetch((url, init) => {
      if (url === ASSEMBLYAI_UPLOAD_URL)
        return jsonResponse({ upload_url: 'https://cdn/audio.mp3' })
      if (url === ASSEMBLYAI_TRANSCRIPT_URL && init?.method === 'POST') {
        return jsonResponse({ id: 'tr_1', status: 'queued' })
      }
      return jsonResponse({
        status: 'completed',
        utterances: [
          { speaker: 'A', start: 1000, end: 2500 },
          { speaker: 'B', start: 2500, end: 4000 },
          { speaker: 'C', start: 'x', end: 10 },
        ],
      })
    })

    const progress = vi.fn()
    const result = await assemblyAiDiarize(audioBlob(), {
      pollIntervalMs: 1,
      onProgress: progress,
    })

    expect(result).toEqual({
      ok: true,
      turns: [
        { speaker: 'A', startSeconds: 1, endSeconds: 2.5 },
        { speaker: 'B', startSeconds: 2.5, endSeconds: 4 },
      ],
    })
    const create = calls.find(
      (call) => call.url === ASSEMBLYAI_TRANSCRIPT_URL && call.init?.method === 'POST',
    )
    expect(create?.init?.body).toContain('"speaker_labels":true')
    expect(create?.init?.body).toContain('"speech_models":["universal-2"]')
    expect(create?.init?.body).toContain('"language_code":"pt"')
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('test-key')
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true)
    expect(progress).toHaveBeenCalled()
  })

  it('answers 503 without a key and never calls the provider', async () => {
    vi.stubEnv('ASSEMBLYAI_API_KEY', '')
    const calls = installFetch(() => jsonResponse({}))

    expect(await assemblyAiDiarize(audioBlob())).toEqual({
      ok: false,
      error: 'Separação de falantes está indisponível no momento.',
      status: 503,
    })
    expect(calls).toHaveLength(0)
  })

  it('degrades to an error when the upload fails', async () => {
    vi.stubEnv('ASSEMBLYAI_API_KEY', 'test-key')
    const calls = installFetch(() => jsonResponse({}, 500))

    const result = await assemblyAiDiarize(audioBlob())
    expect(result.ok).toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('degrades to an error and deletes the remote transcript on provider error', async () => {
    vi.stubEnv('ASSEMBLYAI_API_KEY', 'test-key')
    const calls = installFetch((url, init) => {
      if (url === ASSEMBLYAI_UPLOAD_URL)
        return jsonResponse({ upload_url: 'https://cdn/audio.mp3' })
      if (url === ASSEMBLYAI_TRANSCRIPT_URL && init?.method === 'POST') {
        return jsonResponse({ id: 'tr_9', status: 'queued' })
      }
      if (init?.method === 'DELETE') return jsonResponse({}, 200)
      return jsonResponse({ status: 'error', error: 'provider exploded' })
    })

    expect(await assemblyAiDiarize(audioBlob(), { pollIntervalMs: 1 })).toMatchObject({ ok: false })
    expect(calls.some((call) => call.init?.method === 'DELETE')).toBe(true)
  })

  it('accepts a completed transcript without utterances (honest empty turns)', async () => {
    vi.stubEnv('ASSEMBLYAI_API_KEY', 'test-key')
    installFetch((url, init) => {
      if (url === ASSEMBLYAI_UPLOAD_URL)
        return jsonResponse({ upload_url: 'https://cdn/audio.mp3' })
      if (url === ASSEMBLYAI_TRANSCRIPT_URL && init?.method === 'POST') {
        return jsonResponse({ id: 'tr_2', status: 'queued' })
      }
      return jsonResponse({ status: 'completed', utterances: [] })
    })

    expect(await assemblyAiDiarize(audioBlob(), { pollIntervalMs: 1 })).toEqual({
      ok: true,
      turns: [],
    })
  })
})
