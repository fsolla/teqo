import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { JinglePlayer } from '@/components/jingles/JinglePlayer'
import type { JingleViewModel } from '@/lib/jingle'

const JINGLES: readonly JingleViewModel[] = [
  {
    id: 1,
    title: 'Axé',
    coverUrl: '/api/media/file/capa-axe.jpg',
    coverAlt: 'Capa do jingle Axé de Jorge Solla 1313',
    audioUrl: '/api/media/file/axe.mp3',
    downloadFilename: 'jorge-solla-1313-axe.mp3',
  },
  {
    id: 2,
    title: 'Forró',
    coverUrl: '/api/media/file/capa-forro.jpg',
    coverAlt: 'Capa do jingle Forró de Jorge Solla 1313',
    audioUrl: '/api/media/file/forro.mp3',
    downloadFilename: 'jorge-solla-1313-forro.mp3',
  },
]

const playMock = vi.fn(() => Promise.resolve())
const pauseMock = vi.fn()

const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-jingle]'))
const cardState = (index: number) => cards()[index]?.getAttribute('data-state')
const playButton = (index: number) =>
  cards()[index]?.querySelector<HTMLButtonElement>('button[data-play]') as HTMLButtonElement
const audioOf = (index: number) =>
  cards()[index]?.querySelector<HTMLAudioElement>('audio') as HTMLAudioElement
const progressValue = (title: string) =>
  document.querySelector<HTMLElement>(`[aria-label="Progresso do jingle ${title}"] > div > div`)

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
  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    writable: true,
    value: 0,
  })
})

beforeEach(() => {
  playMock.mockClear()
  playMock.mockImplementation(() => Promise.resolve())
  pauseMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('JinglePlayer', () => {
  it('renders the cards with the download named by slug and lazy audio', () => {
    render(<JinglePlayer jingles={JINGLES} />)

    const download = screen.getByRole('link', { name: 'Baixar Axé em MP3' })
    expect(download.getAttribute('href')).toBe('/api/media/file/axe.mp3')
    expect(download.getAttribute('download')).toBe('jorge-solla-1313-axe.mp3')
    expect(screen.getByText('jorge-solla-1313-axe.mp3')).toBeDefined()
    expect(screen.getByAltText('Capa do jingle Axé de Jorge Solla 1313')).toBeDefined()
    expect(screen.getAllByText('Pronto para tocar')).toHaveLength(2)
    expect(screen.queryByText('Em reprodução')).toBeNull()

    for (const audio of Array.from(document.querySelectorAll('audio'))) {
      expect(audio.getAttribute('preload')).toBe('none')
    }
  })

  it('plays on click and pauses on a second click of the same card', () => {
    render(<JinglePlayer jingles={JINGLES} />)

    // The first play also pauses the sibling card (a no-op with it stopped),
    // so the mock is cleared before pinning the pause of the card itself.
    fireEvent.click(playButton(0))

    expect(playMock).toHaveBeenCalledTimes(1)
    expect(cardState(0)).toBe('playing')
    expect(playButton(0).getAttribute('aria-pressed')).toBe('true')
    expect(playButton(0).getAttribute('aria-label')).toBe('Pausar jingle Axé')
    expect(screen.getByText('Em reprodução')).toBeDefined()

    pauseMock.mockClear()
    fireEvent.click(playButton(0))

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(cardState(0)).toBe('stopped')
    expect(playButton(0).getAttribute('aria-pressed')).toBe('false')
  })

  it('plays one at a time: starting another pauses the previous card', () => {
    render(<JinglePlayer jingles={JINGLES} />)

    fireEvent.click(playButton(0))
    pauseMock.mockClear()
    fireEvent.click(playButton(1))

    expect(pauseMock).toHaveBeenCalledTimes(1)
    expect(cardState(0)).toBe('stopped')
    expect(cardState(1)).toBe('playing')
    expect(playMock).toHaveBeenCalledTimes(2)
  })

  it('reverts the card when the browser refuses to play', async () => {
    playMock.mockImplementationOnce(() => Promise.reject(new Error('blocked')))
    render(<JinglePlayer jingles={JINGLES} />)

    fireEvent.click(playButton(0))

    await waitFor(() => {
      expect(cardState(0)).toBe('stopped')
    })
    expect(playButton(0).getAttribute('aria-pressed')).toBe('false')
  })

  it('does not let a superseded play() rejection stop the card now playing', async () => {
    // Switching cards aborts the pending play of the previous one: its catch
    // must clear only its own id, never the active card.
    let rejectFirstPlay: ((error: Error) => void) | undefined
    playMock.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectFirstPlay = reject
        }),
    )
    render(<JinglePlayer jingles={JINGLES} />)

    fireEvent.click(playButton(0))
    fireEvent.click(playButton(1))

    await act(async () => {
      rejectFirstPlay?.(new Error('The play() request was interrupted'))
    })

    expect(cardState(1)).toBe('playing')
    expect(playButton(1).getAttribute('aria-pressed')).toBe('true')
    expect(cardState(0)).toBe('stopped')
  })

  it('shows the clock and progress from the media events', () => {
    render(<JinglePlayer jingles={JINGLES} />)

    expect(screen.getAllByText(/Tempo —:—/)).toHaveLength(2)
    expect(screen.getAllByText(/Duração —:—/)).toHaveLength(2)

    const audio = audioOf(0)
    fireEvent.click(playButton(0))
    Object.defineProperty(audio, 'duration', { configurable: true, value: 165 })
    fireEvent.loadedMetadata(audio)
    expect(screen.getByText(/Duração 02:45/)).toBeDefined()

    audio.currentTime = 30
    fireEvent.timeUpdate(audio)
    expect(screen.getByText(/Tempo 00:30/)).toBeDefined()
    expect(parseFloat(progressValue('Axé')?.style.width ?? '')).toBeCloseTo(18.18, 1)

    fireEvent.ended(audio)
    expect(cardState(0)).toBe('stopped')
    expect(screen.getAllByText(/Tempo —:—/)).toHaveLength(2)
  })
})
