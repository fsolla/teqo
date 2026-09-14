import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpeechDetailPlayer } from '@/components/campaign/speech/SpeechDetailPlayer'
import type { SpeechDetailSegmentViewModel } from '@/utilities/speech/speechViewModels'

const PLAYBACK_URL = 'https://vod.camara.leg.br/trecho.mp4'
const DOWNLOAD_URL = 'https://vod.camara.leg.br/trecho-download.mp4'

const SEGMENTS: readonly SpeechDetailSegmentViewModel[] = [
  {
    startSeconds: 0,
    endSeconds: 5,
    startLabel: '00:00',
    parts: [{ text: 'Primeiro trecho', highlighted: false }],
  },
  {
    startSeconds: 43,
    endSeconds: 50,
    startLabel: '00:43',
    parts: [{ text: 'O trecho sobre a saúde', highlighted: false }],
  },
]

const pronto = (playbackUrl: string | null, downloadUrl: string | null) => ({
  status: 'success' as const,
  resolution: { state: 'pronto' as const, playbackUrl, downloadUrl },
})
const gerando = { status: 'success' as const, resolution: { state: 'gerando' as const } }
const indisponivel = { status: 'success' as const, resolution: { state: 'indisponivel' as const } }

const fetchMock = vi.fn()

const respondWith = (payload: unknown, ok = true) => {
  fetchMock.mockResolvedValue({ ok, json: async () => payload })
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

const renderPlayer = (props: Partial<Parameters<typeof SpeechDetailPlayer>[0]> = {}) =>
  render(
    <SpeechDetailPlayer
      speechId={42}
      youtubeVideoId={null}
      youtubeOffsetSeconds={null}
      vodResolvable
      segments={SEGMENTS}
      initialSeconds={null}
      sourceUrl={null}
      {...props}
    />,
  )

const videoElement = () => document.querySelector('video')
const iframeElement = () => document.querySelector('iframe')
const playerRoot = () => document.querySelector('[data-slot="speech-player"]')

beforeAll(() => {
  // jsdom does not implement media playback; the seek contract is what matters.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    writable: true,
    value: 0,
  })
})

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('SpeechDetailPlayer — VOD-only quadrant', () => {
  it('resolves on click, shows the pending state and plays the exact excerpt', async () => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValue(pending.promise)

    renderPlayer()

    expect(screen.getByText(/O trecho deste vídeo é gerado pela Câmara/)).toBeDefined()
    expect(videoElement()).toBeNull()
    expect(iframeElement()).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /assistir o trecho/i }))

    await waitFor(() => {
      expect(playerRoot()?.getAttribute('aria-busy')).toBe('true')
    })
    expect(screen.getByText(/Resolvendo o trecho na Câmara/)).toBeDefined()
    const busyDownload = screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i })
    expect((busyDownload as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      pending.resolve({ ok: true, json: async () => pronto(PLAYBACK_URL, DOWNLOAD_URL) })
    })

    await waitFor(() => {
      expect(videoElement()?.getAttribute('src')).toBe(PLAYBACK_URL)
    })
    expect(playerRoot()?.getAttribute('aria-busy')).toBeNull()

    fireEvent.click(document.querySelector('button[data-start-seconds="43"]')!)
    expect(videoElement()?.currentTime).toBe(43)
  })

  it('shows the honest state after a failure and re-posts on retry', async () => {
    respondWith(indisponivel)
    renderPlayer()

    fireEvent.click(screen.getByRole('button', { name: /assistir o trecho/i }))
    expect(await screen.findByText('Não foi possível carregar o vídeo deste trecho.')).toBeDefined()

    respondWith(pronto(PLAYBACK_URL, null))
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() => {
      expect(videoElement()?.getAttribute('src')).toBe(PLAYBACK_URL)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ speechId: 42 })
  })

  it('shows the generating state with a retry and no player', async () => {
    respondWith(gerando)
    renderPlayer()

    fireEvent.click(screen.getByRole('button', { name: /assistir o trecho/i }))

    expect(await screen.findByText(/A Câmara está gerando o trecho deste vídeo/)).toBeDefined()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeDefined()
    expect(videoElement()).toBeNull()
  })

  it('keeps the verified download offered when only the playback probe failed', async () => {
    respondWith(pronto(null, DOWNLOAD_URL))
    renderPlayer()

    fireEvent.click(screen.getByRole('button', { name: /assistir o trecho/i }))

    expect(await screen.findByText('Não foi possível carregar o vídeo deste trecho.')).toBeDefined()
    expect(screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i })).toBeDefined()
    expect(videoElement()).toBeNull()
  })
})

describe('SpeechDetailPlayer — YouTube quadrant', () => {
  it('embeds the session at the offset and seeks the transcript by reloading start', async () => {
    renderPlayer({
      youtubeVideoId: 'lLhRDkSPw0A',
      youtubeOffsetSeconds: 2634,
      initialSeconds: 100,
    })

    expect(videoElement()).toBeNull()
    expect(iframeElement()?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/lLhRDkSPw0A?playsinline=1&rel=0&start=2734',
    )

    fireEvent.click(document.querySelector('button[data-start-seconds="43"]')!)

    await waitFor(() => {
      expect(iframeElement()?.getAttribute('src')).toContain('start=2677')
    })
  })

  it('leaves the transcript inert when the session offset is unknown', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: null })

    expect(screen.queryByText(/clique para posicionar/i)).toBeNull()
    const segment = document.querySelector('button[data-start-seconds="43"]') as HTMLButtonElement
    expect(segment.disabled).toBe(true)
  })

  it('resolves the MP4 on download and opens the verified URL in a pre-opened tab', async () => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValue(pending.promise)
    const tab = { location: { href: '' }, close: vi.fn() }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

    renderPlayer({
      youtubeVideoId: 'lLhRDkSPw0A',
      youtubeOffsetSeconds: 2634,
      initialSeconds: null,
    })

    fireEvent.click(screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i }))
    expect(openSpy).toHaveBeenCalledWith('', '_blank')
    expect(
      (screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i }) as HTMLButtonElement).disabled,
    ).toBe(true)

    await act(async () => {
      pending.resolve({ ok: true, json: async () => pronto(PLAYBACK_URL, DOWNLOAD_URL) })
    })

    await waitFor(() => {
      expect(tab.location.href).toBe(DOWNLOAD_URL)
    })
    expect(tab.close).not.toHaveBeenCalled()
    expect(iframeElement()).not.toBeNull()
  })

  it('closes the tab and shows the honest notice when the resolution fails', async () => {
    respondWith({ status: 'error', message: 'Não foi possível resolver o trecho.' }, false)
    const tab = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    fireEvent.click(screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i }))

    await waitFor(() => {
      expect(tab.close).toHaveBeenCalled()
    })
    expect(await screen.findByText('Não foi possível resolver o trecho.')).toBeDefined()
    expect(iframeElement()).not.toBeNull()
  })
})

describe('SpeechDetailPlayer — no-video quadrant', () => {
  it('renders the unavailable block without retry or download', () => {
    renderPlayer({ vodResolvable: false, sourceUrl: 'https://imagem.camara.leg.br/diario.pdf' })

    expect(screen.getByText('Vídeo indisponível neste momento.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /baixar vídeo/i })).toBeNull()
    expect(screen.getByRole('link', { name: /abrir fonte/i })).toBeDefined()
    expect(videoElement()).toBeNull()
    expect(iframeElement()).toBeNull()
  })
})
