import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useMicTranscript } from '@/components/campaign/shell/ai/useMicTranscript'

/**
 * B173: the voice-input state machine must be testable with stubbed browser
 * APIs — getUserMedia, MediaRecorder and fetch are all faked here. These cases
 * pin the product contract: recording→transcribe→draft, permission-denied
 * message, unsupported-browser message, provider-error pass-through, and the
 * automatic stop when the recording cap is reached.
 */

const defineMediaDevices = (
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<unknown>,
) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
    writable: true,
  })
}

const removeMediaDevices = () => {
  Reflect.deleteProperty(navigator, 'mediaDevices')
}

const makeStream = (): MediaStream =>
  ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream

/** Minimal MediaRecorder: queues a chunk on `start`, dispatches `stop` on `stop`. */
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  private listeners: Record<string, Array<(event: unknown) => void>> = {}

  constructor(public readonly stream: MediaStream) {
    FakeMediaRecorder.instances.push(this)
  }

  addEventListener(type: string, callback: (event: unknown) => void) {
    ;(this.listeners[type] ??= []).push(callback)
  }

  start() {
    this.state = 'recording'
    queueMicrotask(() => {
      this.dispatch('dataavailable', { data: new Blob(['fake-audio'], { type: 'audio/webm' }) })
    })
  }

  stop() {
    if (this.state !== 'recording') return
    this.state = 'inactive'
    this.dispatch('stop', {})
  }

  private dispatch(type: string, event: unknown) {
    for (const callback of this.listeners[type] ?? []) callback(event)
  }
}

const installFakeMediaRecorder = () => {
  FakeMediaRecorder.instances = []
  Object.defineProperty(globalThis, 'MediaRecorder', {
    value: FakeMediaRecorder,
    configurable: true,
    writable: true,
  })
}

const removeFakeMediaRecorder = () => {
  Reflect.deleteProperty(globalThis, 'MediaRecorder')
}

const fetchMock = vi.fn()

const stubTranscribe = (payload: { text?: string; error?: string } | Error, status = 200) => {
  fetchMock.mockReset()
  if (payload instanceof Error) {
    fetchMock.mockRejectedValue(payload)
    return
  }
  fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, json: async () => payload })
}

const resultOf = () => {
  const { result } = renderHook(() => useMicTranscript())
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  installFakeMediaRecorder()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ text: 'padrão' }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  removeFakeMediaRecorder()
  removeMediaDevices()
  vi.unstubAllGlobals()
})

describe('useMicTranscript', () => {
  it('records and delivers the transcript as a draft (never auto-sent)', async () => {
    stubTranscribe({ text: 'Quais os votos em Ilhéus?' })
    const getUserMedia = vi.fn(() => Promise.resolve(makeStream()))
    defineMediaDevices(getUserMedia)
    const result = resultOf()

    await act(async () => {
      await result.current.start()
    })
    expect(result.current.status).toBe('recording')

    await act(async () => {
      result.current.stop()
      await vi.runAllTicks()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.transcript).toBe('Quais os votos em Ilhéus?')
    expect(result.current.errorMessage).toBeNull()
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: FormData }]
    expect(url).toBe('/campanha/api/ai-transcribe')
    expect(init.method).toBe('POST')
    const file = (init.body as FormData).get('file') as File
    expect(file.name).toBe('voice.webm')
  })

  it('maps a permission denial to a pt-BR message and keeps the text chat usable', async () => {
    const getUserMedia = vi.fn(() => Promise.reject(new Error('Permission denied')))
    defineMediaDevices(getUserMedia)
    const result = resultOf()

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toContain('microfone')
    expect(result.current.transcript).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails with a clear message when MediaRecorder is unsupported', async () => {
    removeFakeMediaRecorder()
    const result = resultOf()

    await act(async () => {
      await result.current.start()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toContain('não suporta')
  })

  it('passes the provider error message through (rate limit, outage)', async () => {
    stubTranscribe(
      { error: 'Você atingiu o limite de mensagens. Aguarde alguns minutos e tente novamente.' },
      429,
    )
    const getUserMedia = vi.fn(() => Promise.resolve(makeStream()))
    defineMediaDevices(getUserMedia)
    const result = resultOf()

    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      result.current.stop()
      await vi.runAllTicks()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe(
      'Você atingiu o limite de mensagens. Aguarde alguns minutos e tente novamente.',
    )
    expect(result.current.transcript).toBe('')
  })

  it('degrades to a generic message when transcribe itself throws', async () => {
    stubTranscribe(new Error('network down'))
    const getUserMedia = vi.fn(() => Promise.resolve(makeStream()))
    defineMediaDevices(getUserMedia)
    const result = resultOf()

    await act(async () => {
      await result.current.start()
    })
    await act(async () => {
      result.current.stop()
      await vi.runAllTicks()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toContain('transcrever')
  })

  it('auto-stops and transcribes when the recording cap is reached', async () => {
    stubTranscribe({ text: 'cap' })
    const getUserMedia = vi.fn(() => Promise.resolve(makeStream()))
    defineMediaDevices(getUserMedia)
    const { result } = renderHook(() => useMicTranscript({ maxDurationSeconds: 2 }))

    await act(async () => {
      await result.current.start()
      vi.advanceTimersByTime(2000)
      await vi.runAllTicks()
      await Promise.resolve()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.transcript).toBe('cap')
  })

  it('cleans up tracks on unmount mid-recording', async () => {
    stubTranscribe({ text: 'ok' })
    const trackStop = vi.fn()
    const getUserMedia = vi.fn(() =>
      Promise.resolve({ getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream),
    )
    defineMediaDevices(getUserMedia)
    const { result, unmount } = renderHook(() => useMicTranscript())

    await act(async () => {
      await result.current.start()
      unmount()
    })

    expect(trackStop).toHaveBeenCalled()
  })
})
