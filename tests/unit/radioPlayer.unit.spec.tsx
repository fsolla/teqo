import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { RadioPlayer } from '@/components/jingles/RadioPlayer'
import {
  JINGLE_PLAY_EVENT,
  RADIO_CONNECT_TIMEOUT_MS,
  RADIO_PAGE_URL,
  RADIO_PLAY_EVENT,
  RADIO_SHARE_MESSAGE,
  RADIO_STREAM_URL,
} from '@/lib/radio'

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

const playMock = vi.fn<() => Promise<void>>()
const pauseMock = vi.fn()
const loadMock = vi.fn()

const player = () => document.querySelector<HTMLElement>('[data-radio]')
const dataState = () => player()?.getAttribute('data-state')
const audioOf = () => document.querySelector<HTMLAudioElement>('[data-radio] audio')
const playButton = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-radio] button[aria-pressed]',
  ) as HTMLButtonElement

const captureEvents = (eventName: string) => {
  let count = 0
  const listener = () => {
    count += 1
  }
  window.addEventListener(eventName, listener)
  return {
    count: () => count,
    stop: () => window.removeEventListener(eventName, listener),
  }
}

beforeAll(() => {
  // jsdom does not implement media playback; the state machine is the contract.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => playMock(),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: () => pauseMock(),
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', {
    configurable: true,
    value: () => loadMock(),
  })
})

beforeEach(() => {
  playMock.mockReset()
  playMock.mockResolvedValue(undefined)
  pauseMock.mockReset()
  loadMock.mockReset()
  // The share popover (radix) measures its content on open.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('RadioPlayer', () => {
  it('renders the own player with lazy audio and no iframe', () => {
    render(<RadioPlayer />)

    expect(screen.getByRole('article', { name: 'Player da Rádio Jorge Solla 1313' })).toBeDefined()
    expect(dataState()).toBe('idle')
    expect(document.querySelector('[data-radio] iframe')).toBeNull()
    expect(audioOf()?.getAttribute('preload')).toBe('none')
    expect(audioOf()?.getAttribute('src')).toBe(RADIO_STREAM_URL)
    expect(screen.getByText('Rádio Jorge Solla 1313')).toBeDefined()
    expect(screen.getByText('Ao vivo')).toBeDefined()
    expect(screen.getByText('Pronta para tocar')).toBeDefined()
    expect(playButton().getAttribute('aria-label')).toBe('Ouvir Rádio Jorge Solla 1313')
    expect(playButton().getAttribute('aria-pressed')).toBe('false')
    // One trigger per breakpoint (outline inline on md+, link on the bottom
    // row) — jsdom applies no CSS, so both mounts are in the tree here.
    expect(
      screen.getAllByRole('button', { name: 'Compartilhar Rádio Jorge Solla 1313' }),
    ).toHaveLength(2)
    expect(playMock).not.toHaveBeenCalled()
    expect(loadMock).not.toHaveBeenCalled()
  })

  it('connects on the play and reaches playing with the exclusivity broadcast', async () => {
    const playEvents = captureEvents(RADIO_PLAY_EVENT)
    render(<RadioPlayer />)

    fireEvent.click(playButton())

    expect(loadMock).toHaveBeenCalledTimes(1)
    expect(playMock).toHaveBeenCalledTimes(1)
    expect(dataState()).toBe('connecting')
    expect(playButton().getAttribute('aria-busy')).toBe('true')
    expect(playButton().getAttribute('aria-label')).toBe('Conectando')
    expect(screen.getByText('Conectando à rádio…')).toBeDefined()
    expect(playEvents.count()).toBe(1)

    await waitFor(() => expect(dataState()).toBe('playing'))
    expect(screen.getByText('Em reprodução')).toBeDefined()
    expect(playButton().getAttribute('aria-pressed')).toBe('true')
    expect(playButton().getAttribute('aria-label')).toBe('Pausar Rádio Jorge Solla 1313')
    playEvents.stop()
  })

  it('toggles off and pauses the audio', async () => {
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    await waitFor(() => expect(dataState()).toBe('playing'))

    fireEvent.click(playButton())

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(dataState()).toBe('idle')
    expect(screen.getByText('Pronta para tocar')).toBeDefined()
  })

  it('turns a refused play into the honest error state with the exits', async () => {
    playMock.mockRejectedValueOnce(new Error('blocked'))
    render(<RadioPlayer />)

    fireEvent.click(playButton())

    await waitFor(() => expect(dataState()).toBe('error'))
    expect(screen.getByText('A rádio não conectou')).toBeDefined()
    expect(screen.getByText('Tente de novo ou ouça na página da rádio.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeDefined()
    const zeno = screen.getByRole('link', { name: 'Ouvir no Zeno' })
    expect(zeno.getAttribute('href')).toBe(RADIO_PAGE_URL)
    expect(zeno.getAttribute('target')).toBe('_blank')
    expect(zeno.getAttribute('rel')).toBe('noopener noreferrer')
    expect(
      screen.getByRole('button', { name: 'Compartilhar Rádio Jorge Solla 1313' }),
    ).toBeDefined()
  })

  it('turns a media error event into the error state', () => {
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    fireEvent.error(audioOf()!)

    expect(dataState()).toBe('error')
    expect(screen.getByText('A rádio não conectou')).toBeDefined()
  })

  it('never spins forever: the connect timeout becomes the error state', () => {
    vi.useFakeTimers()
    playMock.mockImplementationOnce(() => new Promise<void>(() => {}))
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    expect(dataState()).toBe('connecting')

    act(() => {
      vi.advanceTimersByTime(RADIO_CONNECT_TIMEOUT_MS)
    })

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(dataState()).toBe('error')
    expect(screen.getByText('A rádio não conectou')).toBeDefined()
  })

  it('retries with a fresh request from the error state', async () => {
    playMock.mockRejectedValueOnce(new Error('blocked'))
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    await waitFor(() => expect(dataState()).toBe('error'))

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(loadMock).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(dataState()).toBe('playing'))
  })

  it('pauses the radio when a jingle starts', async () => {
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    await waitFor(() => expect(dataState()).toBe('playing'))

    act(() => {
      window.dispatchEvent(
        new CustomEvent(JINGLE_PLAY_EVENT, { detail: { source: 'jingle', id: 7 } }),
      )
    })

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(dataState()).toBe('idle')
    expect(screen.getByText('Pronta para tocar')).toBeDefined()
  })

  it('ignores a superseded play() resolution after the user pauses', async () => {
    let resolveFirst: (() => void) | undefined
    playMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve
        }),
    )
    render(<RadioPlayer />)

    fireEvent.click(playButton())
    expect(dataState()).toBe('connecting')

    fireEvent.click(playButton())
    expect(dataState()).toBe('idle')

    await act(async () => {
      resolveFirst?.()
    })

    expect(dataState()).toBe('idle')
  })

  it('keeps a single share trigger in the compact variant', () => {
    const { container } = render(<RadioPlayer compact />)

    expect(container.querySelector('[data-radio]')?.className).toContain('max-w-[880px]')
    expect(
      screen.getAllByRole('button', { name: 'Compartilhar Rádio Jorge Solla 1313' }),
    ).toHaveLength(1)
    expect(container.querySelector('[data-radio] iframe')).toBeNull()
  })

  it('shows the literal message and the two exits in the share popover', async () => {
    render(<RadioPlayer />)

    const [trigger] = screen.getAllByRole('button', {
      name: 'Compartilhar Rádio Jorge Solla 1313',
    })
    fireEvent.click(trigger!)

    expect(await screen.findByText(RADIO_SHARE_MESSAGE)).toBeDefined()
    // The portal escapes the home's theme wrapper: the content has to carry
    // `data-theme` or the campaign tokens render the CTA invisible.
    expect(
      document.querySelector('[data-slot="popover-content"]')?.getAttribute('data-theme'),
    ).toBe('campaign-site')
    const whatsApp = screen.getByRole('link', { name: 'Compartilhar no WhatsApp' })
    expect(whatsApp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(new URL(whatsApp.getAttribute('href')!).searchParams.get('text')).toBe(
      RADIO_SHARE_MESSAGE,
    )
    expect(whatsApp.getAttribute('target')).toBe('_blank')
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDefined()
  })
})
