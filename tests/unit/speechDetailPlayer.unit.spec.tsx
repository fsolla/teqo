import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpeechDetailPlayer } from '@/components/campaign/speech/SpeechDetailPlayer'
import { resetCampaignCoarsePointerForTests } from '@/lib/campaignCoarsePointer'
import type { SpeechDetailSegmentViewModel } from '@/utilities/speech/speechViewModels'

import { stubMatchMedia } from '../helpers/matchMedia'

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
      durationSeconds={300}
      speechType="BREVES COMUNICAÇÕES"
      speechDateLabel="11/08/2026"
      speechSummary={null}
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
  resetCampaignCoarsePointerForTests()
  stubMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
    // The invariant: rendering the detail never calls the Câmara.
    expect(fetchMock).not.toHaveBeenCalled()

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

  it('embeds the session at the excerpt offset even without a ?t deep link', () => {
    renderPlayer({
      youtubeVideoId: 'lLhRDkSPw0A',
      youtubeOffsetSeconds: 2634,
      initialSeconds: null,
    })

    expect(iframeElement()?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/lLhRDkSPw0A?playsinline=1&rel=0&start=2634',
    )
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

describe('SpeechDetailPlayer — C166 excerpt selection and share', () => {
  const segmentButton = (seconds: number) =>
    document.querySelector(`button[data-start-seconds="${seconds}"]`) as HTMLButtonElement
  const startSlider = () => screen.getByRole('slider', { name: 'Início do trecho' })
  const endSlider = () => screen.getByRole('slider', { name: 'Fim do trecho' })
  const toggleSelection = () =>
    fireEvent.click(screen.getByRole('button', { name: /selecionar trecho/i }))

  it('turns phrase clicks into magnet selection while the mode is on, keeping C162 outside it', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    expect(startSlider().getAttribute('aria-valuenow')).toBe('0')
    expect(endSlider().getAttribute('aria-valuenow')).toBe('5')

    fireEvent.click(segmentButton(43))
    expect(startSlider().getAttribute('aria-valuenow')).toBe('0')
    expect(endSlider().getAttribute('aria-valuenow')).toBe('50')
    expect(endSlider().getAttribute('aria-valuemax')).toBe('300')
    // C162 contract: the selection mode does not seek the embed.
    expect(iframeElement()?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/lLhRDkSPw0A?playsinline=1&rel=0&start=2634',
    )

    // Clicking a phrase inside the range re-selects it alone.
    fireEvent.click(segmentButton(43))
    expect(startSlider().getAttribute('aria-valuenow')).toBe('43')

    // Outside the mode the transcript click seeks exactly as before.
    toggleSelection()
    fireEvent.click(segmentButton(43))
    expect(iframeElement()?.getAttribute('src')).toContain('start=2677')
  })

  it('adjusts the edges by keyboard with the 5 s minimum and no upper cap', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(segmentButton(43))

    fireEvent.keyDown(startSlider(), { key: 'ArrowRight' })
    expect(startSlider().getAttribute('aria-valuenow')).toBe('1')
    fireEvent.keyDown(startSlider(), { key: 'PageUp' })
    expect(startSlider().getAttribute('aria-valuenow')).toBe('6')
    fireEvent.keyDown(startSlider(), { key: 'End' })
    expect(startSlider().getAttribute('aria-valuenow')).toBe('45')

    fireEvent.keyDown(endSlider(), { key: 'End' })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('300')
    expect(screen.getByText(/4min15s/)).toBeDefined()

    fireEvent.keyDown(endSlider(), { key: 'ArrowLeft' })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('299')
    fireEvent.keyDown(endSlider(), { key: 'Home' })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('50')
  })

  it('keeps the selection available without YouTube and states the link limit honestly', () => {
    renderPlayer({ youtubeVideoId: null, vodResolvable: false })

    expect(screen.getByText('Compartilhar por link exige o vídeo no YouTube')).toBeDefined()
    toggleSelection()
    expect(screen.queryByRole('button', { name: /^compartilhar$/i })).toBeNull()

    fireEvent.click(segmentButton(43))
    expect(endSlider().getAttribute('aria-valuenow')).toBe('50')
  })

  it('enables the phrases in selection mode and drops t when the offset is unknown', async () => {
    const writeText = vi.fn(async (_text: string) => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: null })

    expect(segmentButton(43).disabled).toBe(true)
    toggleSelection()
    expect(segmentButton(43).disabled).toBe(false)

    fireEvent.click(segmentButton(43))
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))
    expect(await screen.findByText('O link abre o vídeo no início da sessão.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const copied = String(writeText.mock.calls[0]?.[0])
    expect(copied).toContain('https://www.youtube.com/watch?v=lLhRDkSPw0A')
    expect(copied).not.toContain('&t=')
  })

  it('copies the message with the interval and links WhatsApp with the same text', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(segmentButton(43))
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))

    const whatsapp = await screen.findByRole('link', { name: /enviar no whatsapp/i })
    expect(whatsapp.getAttribute('href')).toContain('https://wa.me/?text=')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Trecho de BREVES COMUNICAÇÕES (11/08/2026): de 00:00 a 00:50 https://www.youtube.com/watch?v=lLhRDkSPw0A&t=2634',
      ),
    )
    expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeDefined()
  })

  it('reports a copy failure without crashing', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar link' }))

    expect(await screen.findByRole('button', { name: 'Não foi possível copiar' })).toBeDefined()
  })

  it('opens the share options as a bottom sheet on coarse pointers', async () => {
    stubMatchMedia(true)
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))

    expect(await screen.findByText('Compartilhar trecho')).toBeDefined()
    expect(screen.getByText('O link abre o vídeo no ponto escolhido.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDefined()
    expect(screen.getByRole('link', { name: /enviar no whatsapp/i })).toBeDefined()
  })

  it('drags a handle with the phrase-boundary magnet', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })
    toggleSelection()

    const track = document.querySelector('[data-slot="speech-excerpt-track"]') as HTMLDivElement
    track.getBoundingClientRect = () => ({
      left: 0,
      width: 300,
      top: 0,
      height: 36,
      right: 300,
      bottom: 36,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const handle = document.querySelector('[data-excerpt-edge="end"]') as HTMLDivElement
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    handle.setPointerCapture = setPointerCapture
    handle.hasPointerCapture = vi.fn(() => true)
    handle.releasePointerCapture = releasePointerCapture

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 5 })
    expect(setPointerCapture).toHaveBeenCalledWith(1)

    // 44s is within the magnet window of the 43s phrase start.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 44 })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('43')

    // 150s is far from every boundary, so the handle moves freely.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 150 })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('150')

    // 250s is far from every boundary and within the speech, so the handle moves freely.
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 250 })
    expect(endSlider().getAttribute('aria-valuenow')).toBe('250')

    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 250 })
    expect(releasePointerCapture).toHaveBeenCalled()
  })

  it('resets the copy feedback after its window', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))
    const copyButton = await screen.findByRole('button', { name: 'Copiar link' })

    vi.useFakeTimers()
    fireEvent.click(copyButton)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Link copiado' })).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDefined()
  })
})
