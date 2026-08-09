import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEEPINFRA_TRANSCRIBE_URL, deepInfraTranscribe } from '@/utilities/ai/deepInfraTranscribe'

/**
 * B173: the transcription network seam is deliberately the only place the chat
 * talks to Deep Infra for voice. Here, with `fetch` stubbed, the contract is
 * pinned: the multipart body carries the clip/model/language, the key is sent
 * as a Bearer header and never inside the body, and every failure degrades to
 * `{ ok: false }` with a pt-BR message instead of throwing.
 */

const fetchMock = vi.fn()

const jsonResponse = (payload: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => payload }) as Response

const smallClip = () => new Blob(['fake-webaudio-bytes'], { type: 'audio/webm' })

const stubFetch = (response: Response) => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
}

beforeEach(() => {
  process.env.DEEPINFRA_API_KEY = 'test-deepinfra-key'
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse({ text: 'Quais os votos em Ilhéus?' }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  delete process.env.DEEPINFRA_API_KEY
  vi.unstubAllGlobals()
})

describe('deepInfraTranscribe', () => {
  it('posts the clip as multipart with the whisper model and pt language', async () => {
    stubFetch(jsonResponse({ text: 'Quais os votos em Ilhéus?' }))

    const result = await deepInfraTranscribe(smallClip())

    expect(result).toEqual({ ok: true, text: 'Quais os votos em Ilhéus?' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: HeadersInit; body: FormData },
    ]
    expect(url).toBe(DEEPINFRA_TRANSCRIBE_URL)
    expect(url).not.toContain('test-deepinfra-key') // the key never rides the URL
    expect(init.method).toBe('POST')
    const auth = new Headers(init.headers)
    expect(auth.get('Authorization')).toBe('Bearer test-deepinfra-key')
    const form = init.body
    expect(form.get('model')).toBe('openai/whisper-large-v3')
    expect(form.get('language')).toBe('pt')
    const file = form.get('file') as File
    expect(file.name).toBe('voice.webm')
  })

  it('trims the transcript text', async () => {
    stubFetch(jsonResponse({ text: '  Votos em Feira?  ' }))

    await expect(deepInfraTranscribe(smallClip())).resolves.toEqual({
      ok: true,
      text: 'Votos em Feira?',
    })
  })

  it('fails closed when the key is missing', async () => {
    delete process.env.DEEPINFRA_API_KEY
    fetchMock.mockReset()

    const result = await deepInfraTranscribe(smallClip())

    expect(result).toEqual({
      ok: false,
      error: 'Transcrição de voz está indisponível no momento.',
      status: 503,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps a provider error to a 502 without throwing', async () => {
    stubFetch(jsonResponse({ error: 'server error' }, 500))

    await expect(deepInfraTranscribe(smallClip())).resolves.toEqual({
      ok: false,
      error: 'Não foi possível transcrever o áudio. Tente novamente.',
      status: 502,
    })
  })

  it('maps an empty transcript to a 502', async () => {
    stubFetch(jsonResponse({ text: '' }))

    await expect(deepInfraTranscribe(smallClip())).resolves.toEqual({
      ok: false,
      error: 'Não foi possível transcrever o áudio. Tente novamente.',
      status: 502,
    })
  })

  it('degrades to a 502 when the provider call throws', async () => {
    fetchMock.mockReset()
    fetchMock.mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deepInfraTranscribe(smallClip())).resolves.toEqual({
      ok: false,
      error: 'Não foi possível transcrever o áudio. Tente novamente.',
      status: 502,
    })
  })
})
