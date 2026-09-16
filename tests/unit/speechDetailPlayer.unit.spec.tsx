import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SpeechDetailPlayer } from '@/components/campaign/speech/SpeechDetailPlayer'
import { resetCampaignCoarsePointerForTests } from '@/lib/campaignCoarsePointer'
import { SPEECH_EXCERPT_REQUEST_EVENT } from '@/lib/speechExcerptSelection'
import type { SpeechDetailSegmentViewModel } from '@/utilities/speech/speechViewModels'

import { stubMatchMedia } from '../helpers/matchMedia'

const PLAYBACK_URL = 'https://vod.camara.leg.br/trecho.mp4'
const DOWNLOAD_URL = 'https://vod.camara.leg.br/trecho-download.mp4'
const YOUTUBE_ID = 'lLhRDkSPw0A'
const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=lLhRDkSPw0A'

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
      officialTextUrl={null}
      durationSeconds={300}
      speechType="BREVES COMUNICAÇÕES"
      speechDateLabel="11/08/2026"
      speechSummary={null}
      {...props}
    />,
  )

const videoElement = () => document.querySelector('video')
const iframeElement = () => document.querySelector('iframe')
const facadeElement = () => document.querySelector('[data-slot="speech-youtube-facade"]')
const exitLink = () => document.querySelector('[data-slot="speech-youtube-exit-link"]')
const playerRoot = () => document.querySelector('[data-slot="speech-player"]')
const watchExcerptButton = () => screen.getByRole('button', { name: /assistir o trecho/i })
const segmentButton = (seconds: number) =>
  document.querySelector(`button[data-start-seconds="${seconds}"]`) as HTMLButtonElement

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

describe('SpeechDetailPlayer — VOD quadrant', () => {
  it('resolves on click, shows the pending state and plays the exact excerpt', async () => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValue(pending.promise)

    renderPlayer()

    expect(screen.getByText(/O trecho deste vídeo é gerado pela Câmara/)).toBeDefined()
    expect(videoElement()).toBeNull()
    expect(iframeElement()).toBeNull()
    // C178 — without a YouTube id there is no cover and no exit.
    expect(screen.queryByText(/Se o vídeo não abrir aqui/)).toBeNull()
    expect(exitLink()).toBeNull()
    // The invariant: rendering the detail never calls the Câmara.
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(watchExcerptButton())

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

    fireEvent.click(segmentButton(43))
    expect(videoElement()?.currentTime).toBe(43)
  })

  it('shows the honest state after a failure and re-posts on retry', async () => {
    respondWith(indisponivel)
    renderPlayer()

    fireEvent.click(watchExcerptButton())
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

    fireEvent.click(watchExcerptButton())

    expect(await screen.findByText(/A Câmara está gerando o trecho deste vídeo/)).toBeDefined()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeDefined()
    expect(videoElement()).toBeNull()
  })

  it('keeps the verified download offered when only the playback probe failed', async () => {
    respondWith(pronto(null, DOWNLOAD_URL))
    renderPlayer()

    fireEvent.click(watchExcerptButton())

    expect(await screen.findByText('Não foi possível carregar o vídeo deste trecho.')).toBeDefined()
    expect(screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i })).toBeDefined()
    expect(videoElement()).toBeNull()
  })
})

describe('SpeechDetailPlayer — C178 the YouTube embed is never the entry', () => {
  it('defaults to the Câmara excerpt when the speech has both sources', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      initialSeconds: 100,
    })

    expect(iframeElement()).toBeNull()
    expect(videoElement()).toBeNull()
    expect(screen.getByText(/O trecho deste vídeo é gerado pela Câmara/)).toBeDefined()
    // The old surface switch is gone: the Câmara is already the default.
    expect(screen.queryByRole('button', { name: /assistir na câmara/i })).toBeNull()
  })

  it('renders a clickable cover — never an iframe — when only YouTube exists', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      vodResolvable: false,
    })

    expect(iframeElement()).toBeNull()
    expect(videoElement()).toBeNull()
    const facade = facadeElement() as HTMLAnchorElement
    expect(facade).not.toBeNull()
    expect(facade.getAttribute('href')).toBe(`${YOUTUBE_WATCH_URL}&t=2634`)
    expect(facade.getAttribute('target')).toBe('_blank')
    expect(facade.getAttribute('rel')).toBe('noreferrer')
    expect(screen.getByText('Vídeo no YouTube')).toBeDefined()
    // The Câmara panel would promise a surface this speech does not have.
    expect(screen.queryByText(/gerado pela Câmara dos Deputados/)).toBeNull()
  })

  it('drops t from the cover link when the session offset is unknown', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: null,
      vodResolvable: false,
    })

    expect(facadeElement()?.getAttribute('href')).toBe(YOUTUBE_WATCH_URL)
  })

  it('leaves the transcript inert when there is no in-page surface', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      vodResolvable: false,
    })

    expect(screen.queryByText(/clique para posicionar/i)).toBeNull()
    expect(segmentButton(43).disabled).toBe(true)
    // The selection mode still enables the phrases (C166).
    fireEvent.click(screen.getByRole('button', { name: /selecionar trecho/i }))
    expect(segmentButton(43).disabled).toBe(false)
  })

  it('repeats the external exit in a labelled box below the cover', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      vodResolvable: false,
    })

    expect(document.querySelectorAll('[data-slot="speech-youtube-exit-link"]').length).toBe(1)
    const link = exitLink() as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe(`${YOUTUBE_WATCH_URL}&t=2634`)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    // Without a player on the page the "if the video fails here" copy would lie.
    expect(screen.queryByText('Se o vídeo não abrir aqui, assista por outro caminho:')).toBeNull()
  })
})

describe('SpeechDetailPlayer — C178 the exit is always one click away', () => {
  it('keeps the exit visible with the Câmara panel, pointed at the deep link', () => {
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      initialSeconds: 100,
    })

    expect(screen.getByText('Se o vídeo não abrir aqui, assista por outro caminho:')).toBeDefined()
    expect(
      screen.getByText('O trecho da Câmara toca nesta página; o YouTube abre no ponto da fala.'),
    ).toBeDefined()
    expect(exitLink()?.getAttribute('href')).toBe(`${YOUTUBE_WATCH_URL}&t=2734`)
  })

  it('keeps the exit visible while the Câmara resolves and when it fails', async () => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValue(pending.promise)

    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })
    fireEvent.click(watchExcerptButton())

    expect(screen.getByText(/Resolvendo o trecho na Câmara/)).toBeDefined()
    expect(exitLink()).not.toBeNull()

    await act(async () => {
      pending.resolve({ ok: true, json: async () => indisponivel })
    })

    expect(await screen.findByText('Não foi possível carregar o vídeo deste trecho.')).toBeDefined()
    expect(exitLink()).not.toBeNull()
  })

  it('follows the phrase being played on the Câmara surface', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({
      youtubeVideoId: YOUTUBE_ID,
      youtubeOffsetSeconds: 2634,
      initialSeconds: 100,
    })

    fireEvent.click(watchExcerptButton())
    await waitFor(() => expect(videoElement()).not.toBeNull())

    const video = videoElement()!
    video.currentTime = 43
    fireEvent.timeUpdate(video)

    expect(exitLink()?.getAttribute('href')).toBe(`${YOUTUBE_WATCH_URL}&t=2677`)
  })

  it('resolves the MP4 on download and opens the verified URL in a pre-opened tab', async () => {
    const pending = deferred<{ ok: boolean; json: () => Promise<unknown> }>()
    fetchMock.mockReturnValue(pending.promise)
    const tab = { location: { href: '' }, close: vi.fn() }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

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
    expect(videoElement()?.getAttribute('src')).toBe(PLAYBACK_URL)
    expect(iframeElement()).toBeNull()
  })

  it('closes the tab and shows the honest notice when the resolution fails', async () => {
    respondWith({ status: 'error', message: 'Não foi possível resolver o trecho.' }, false)
    const tab = { location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)

    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

    fireEvent.click(screen.getByRole('button', { name: /baixar vídeo \(mp4\)/i }))

    await waitFor(() => {
      expect(tab.close).toHaveBeenCalled()
    })
    expect(await screen.findByText('Não foi possível resolver o trecho.')).toBeDefined()
    expect(exitLink()).not.toBeNull()
  })
})

describe('SpeechDetailPlayer — C181 the YouTube embed is one click away', () => {
  const embedSwitch = () => screen.getByRole('button', { name: /assistir no youtube/i })
  const cameraSwitch = () => screen.getByRole('button', { name: /assistir na câmara/i })

  it('switches to the embed on click and back to the Câmara excerpt', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634, initialSeconds: 100 })

    // C178 stays the entry: no iframe until the assessor asks for the YouTube.
    expect(iframeElement()).toBeNull()
    expect(embedSwitch()).toBeDefined()

    fireEvent.click(embedSwitch())
    expect(iframeElement()?.getAttribute('src')).toBe(
      `https://www.youtube.com/embed/${YOUTUBE_ID}?playsinline=1&rel=0&start=2734`,
    )
    expect(videoElement()).toBeNull()

    fireEvent.click(cameraSwitch())
    await waitFor(() => expect(videoElement()?.getAttribute('src')).toBe(PLAYBACK_URL))
    expect(iframeElement()).toBeNull()
  })

  it('carries the transcript point back to the Câmara video', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634, initialSeconds: 100 })

    fireEvent.click(embedSwitch())
    fireEvent.click(segmentButton(43))
    expect(iframeElement()?.getAttribute('src')).toBe(
      `https://www.youtube.com/embed/${YOUTUBE_ID}?playsinline=1&rel=0&start=2677`,
    )

    fireEvent.click(cameraSwitch())
    await waitFor(() => expect(videoElement()).not.toBeNull())
    await waitFor(() => {
      fireEvent.loadedMetadata(videoElement()!)
      expect(videoElement()?.currentTime).toBe(43)
    })
  })
})

describe('SpeechDetailPlayer — C178 the deep link seeks the Câmara surface', () => {
  // The seek effect attaches its `loadedmetadata` listener on the passive
  // effect pass, which can land after the video is in the DOM under load;
  // re-dispatching inside waitFor closes that window deterministically.
  const applyLoadedMetadata = async (seconds: number) => {
    await waitFor(() => {
      fireEvent.loadedMetadata(videoElement()!)
      expect(videoElement()?.currentTime).toBe(seconds)
    })
  }

  it('seeks the deep-linked point on the VOD-only surface', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ initialSeconds: 100 })

    fireEvent.click(watchExcerptButton())
    await waitFor(() => expect(videoElement()).not.toBeNull())
    await applyLoadedMetadata(100)
  })

  it('seeks the deep-linked point on the both-sources surface', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634, initialSeconds: 100 })

    fireEvent.click(watchExcerptButton())
    await waitFor(() => expect(videoElement()).not.toBeNull())
    await applyLoadedMetadata(100)
  })

  it('leaves the fresh Câmara video at zero without a deep link', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634, initialSeconds: null })

    fireEvent.click(watchExcerptButton())
    await waitFor(() => expect(videoElement()).not.toBeNull())
    await applyLoadedMetadata(0)
  })

  it('does not re-seek as playback advances after the deep link was applied', async () => {
    respondWith(pronto(PLAYBACK_URL, DOWNLOAD_URL))
    renderPlayer({ initialSeconds: 100 })

    fireEvent.click(watchExcerptButton())
    await waitFor(() => expect(videoElement()).not.toBeNull())
    await applyLoadedMetadata(100)

    const video = videoElement()!
    video.currentTime = 177
    fireEvent.timeUpdate(video)
    fireEvent.loadedMetadata(video)

    expect(video.currentTime).toBe(177)
  })
})

describe('SpeechDetailPlayer — C174 excerpt request from outside the player', () => {
  const announcement = () =>
    act(() => {
      window.dispatchEvent(new CustomEvent(SPEECH_EXCERPT_REQUEST_EVENT))
    })

  it('turns the picker on when the empty-state CTA announces the intent', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    expect(screen.queryByRole('slider', { name: 'Início do trecho' })).toBeNull()

    announcement()

    expect(screen.getByRole('slider', { name: 'Início do trecho' })).toBeDefined()
  })

  it('does not overwrite an active range', () => {
    renderPlayer({ youtubeVideoId: 'lLhRDkSPw0A', youtubeOffsetSeconds: 2634 })

    fireEvent.click(screen.getByRole('button', { name: /selecionar trecho/i }))
    // Clicking the 43s phrase twice re-selects it alone: [43, 50].
    fireEvent.click(document.querySelector('button[data-start-seconds="43"]')!)
    fireEvent.click(document.querySelector('button[data-start-seconds="43"]')!)
    const startSlider = () => screen.getByRole('slider', { name: 'Início do trecho' })
    expect(startSlider().getAttribute('aria-valuenow')).toBe('43')

    announcement()

    expect(startSlider().getAttribute('aria-valuenow')).toBe('43')
  })
})

describe('SpeechDetailPlayer — no-video quadrant', () => {
  it('renders the unavailable block without retry or download', () => {
    renderPlayer({
      vodResolvable: false,
      officialTextUrl: 'https://imagem.camara.leg.br/diario.pdf',
    })

    expect(screen.getByText('Vídeo indisponível neste momento.')).toBeDefined()
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /baixar vídeo/i })).toBeNull()
    expect(screen.getByRole('link', { name: /abrir diário oficial/i })).toBeDefined()
    expect(screen.queryByText(/Se o vídeo não abrir aqui/)).toBeNull()
    expect(exitLink()).toBeNull()
    expect(videoElement()).toBeNull()
    expect(iframeElement()).toBeNull()
  })

  it('drops the source button without the official text (C177)', () => {
    renderPlayer({ vodResolvable: false, officialTextUrl: null })

    expect(screen.queryByRole('link', { name: /abrir diário oficial/i })).toBeNull()
    expect(screen.queryByText(/abrir o Diário Oficial/)).toBeNull()
  })

  it('promises only the exits it renders in the no-YouTube notice (C177)', () => {
    renderPlayer({ youtubeVideoId: null, vodResolvable: false, officialTextUrl: null })
    expect(screen.getByText(/A seleção de trecho continua disponível\.$/)).toBeDefined()

    cleanup()
    renderPlayer({ youtubeVideoId: null, vodResolvable: true, officialTextUrl: null })
    expect(screen.getByText(/e você ainda pode baixar o MP4\.$/)).toBeDefined()

    cleanup()
    renderPlayer({
      youtubeVideoId: null,
      vodResolvable: false,
      officialTextUrl: 'https://imagem.camara.leg.br/diario.pdf',
    })
    expect(screen.getByText(/e você ainda pode abrir o Diário Oficial\.$/)).toBeDefined()

    cleanup()
    renderPlayer({
      youtubeVideoId: null,
      vodResolvable: true,
      officialTextUrl: 'https://imagem.camara.leg.br/diario.pdf',
    })
    expect(
      screen.getByText(/e você ainda pode baixar o MP4 ou abrir o Diário Oficial\.$/),
    ).toBeDefined()
  })
})

describe('SpeechDetailPlayer — C166 excerpt selection and share', () => {
  const startSlider = () => screen.getByRole('slider', { name: 'Início do trecho' })
  const endSlider = () => screen.getByRole('slider', { name: 'Fim do trecho' })
  const toggleSelection = () =>
    fireEvent.click(screen.getByRole('button', { name: /selecionar trecho/i }))

  it('turns phrase clicks into magnet selection while the mode is on', () => {
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

    toggleSelection()
    expect(startSlider().getAttribute('aria-valuenow')).toBe('0')
    expect(endSlider().getAttribute('aria-valuenow')).toBe('5')

    fireEvent.click(segmentButton(43))
    expect(startSlider().getAttribute('aria-valuenow')).toBe('0')
    expect(endSlider().getAttribute('aria-valuenow')).toBe('50')
    expect(endSlider().getAttribute('aria-valuemax')).toBe('300')

    // Clicking a phrase inside the range re-selects it alone.
    fireEvent.click(segmentButton(43))
    expect(startSlider().getAttribute('aria-valuenow')).toBe('43')

    // Outside the mode there is no in-page surface yet, so the phrase is inert.
    toggleSelection()
    expect(segmentButton(43).disabled).toBe(true)
    expect(videoElement()).toBeNull()
  })

  it('adjusts the edges by keyboard with the 5 s minimum and no upper cap', () => {
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

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
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: null })

    expect(segmentButton(43).disabled).toBe(true)
    toggleSelection()
    expect(segmentButton(43).disabled).toBe(false)

    fireEvent.click(segmentButton(43))
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))
    expect(await screen.findByText('O link abre o vídeo no início da sessão.')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const copied = String(writeText.mock.calls[0]?.[0])
    expect(copied).toContain(YOUTUBE_WATCH_URL)
    expect(copied).not.toContain('&t=')
  })

  it('copies the message with the interval and links WhatsApp with the same text', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(segmentButton(43))
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))

    const whatsapp = await screen.findByRole('link', { name: /enviar no whatsapp/i })
    expect(whatsapp.getAttribute('href')).toContain('https://wa.me/?text=')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `Trecho de BREVES COMUNICAÇÕES (11/08/2026): de 00:00 a 00:50 ${YOUTUBE_WATCH_URL}&t=2634`,
      ),
    )
    expect(await screen.findByRole('button', { name: 'Link copiado' })).toBeDefined()
  })

  it('reports a copy failure without crashing', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('denied')
    })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar link' }))

    expect(await screen.findByRole('button', { name: 'Não foi possível copiar' })).toBeDefined()
  })

  it('opens the share options as a bottom sheet on coarse pointers', async () => {
    stubMatchMedia(true)
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

    toggleSelection()
    fireEvent.click(screen.getByRole('button', { name: /^compartilhar$/i }))

    expect(await screen.findByText('Compartilhar trecho')).toBeDefined()
    expect(screen.getByText('O link abre o vídeo no ponto escolhido.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDefined()
    expect(screen.getByRole('link', { name: /enviar no whatsapp/i })).toBeDefined()
  })

  it('drags a handle with the phrase-boundary magnet', () => {
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })
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
    renderPlayer({ youtubeVideoId: YOUTUBE_ID, youtubeOffsetSeconds: 2634 })

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
