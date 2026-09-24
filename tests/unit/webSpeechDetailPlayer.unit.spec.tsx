import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSpeechDetailPlayer } from '@/components/campaign/speech/WebSpeechDetailPlayer'
import type {
  SpeechDetailSegmentViewModel,
  WebSpeechDetailViewModel,
} from '@/utilities/speech/speechViewModels'

/**
 * C217 — the web detail's cut picker: the transcript marks/extend the excerpt
 * (data-selected) and "Cortar trecho" opens the existing cut dialog with the
 * picked window; without the private mirror there is no gesture at all.
 */

const SEGMENTS: readonly SpeechDetailSegmentViewModel[] = [
  {
    startSeconds: 12,
    endSeconds: 20,
    startLabel: '00:12',
    parts: [{ text: 'A saúde pública baiana', highlighted: false }],
  },
  {
    startSeconds: 21,
    endSeconds: 30,
    startLabel: '00:21',
    parts: [{ text: 'e a educação no interior', highlighted: false }],
  },
]

const webSpeech = (
  overrides: Partial<WebSpeechDetailViewModel> = {},
): WebSpeechDetailViewModel => ({
  id: 42,
  title: 'Entrevista na rádio Metrópole',
  platform: { value: 'radio', label: 'Rádio' },
  dateLabel: '20/09/2026',
  durationLabel: '2min',
  durationSeconds: 120,
  channel: 'Rádio Metrópole',
  sourceUrl: 'https://radio.example/entrevista',
  mediaKind: 'audio',
  fileHref: '/campanha/comunicacao/acervo/internet/42/arquivo',
  downloadHref: '/campanha/comunicacao/acervo/internet/42/arquivo?download=1',
  segments: [...SEGMENTS],
  topics: [],
  scopes: [],
  ...overrides,
})

const fetchMock = vi.fn()

const renderPlayer = (overrides: Partial<WebSpeechDetailViewModel> = {}) =>
  render(<WebSpeechDetailPlayer speech={webSpeech(overrides)} initialSeconds={null} />)

const segmentButton = (seconds: number) =>
  document.querySelector(`button[data-start-seconds="${seconds}"]`) as HTMLButtonElement

beforeAll(() => {
  // jsdom does not implement media playback; the seek/mark contract is what matters.
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'success',
      suggestion: { title: 'Título sugerido', description: 'Descrição sugerida', source: 'ai' },
    }),
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('WebSpeechDetailPlayer — cut picker (C217)', () => {
  it('offers "Cortar trecho" with the picker hint and no Câmara toggle', () => {
    renderPlayer()

    expect(screen.getByRole('button', { name: /Cortar trecho/ })).toBeTruthy()
    expect(screen.getByText('Selecione na transcrição as frases do trecho.')).toBeTruthy()
    expect(screen.getByText('Clique nas frases')).toBeTruthy()
    expect(screen.getByText('Toque para selecionar')).toBeTruthy()
    expect(screen.queryByText('Selecionar trecho')).toBeNull()
    expect(segmentButton(12).getAttribute('data-selected')).toBeNull()
  })

  it('offers no gesture when the mirrored file is missing', () => {
    renderPlayer({ fileHref: null, downloadHref: null })

    expect(screen.queryByRole('button', { name: /Cortar trecho/ })).toBeNull()
    expect(screen.queryByText('Selecione na transcrição as frases do trecho.')).toBeNull()

    fireEvent.click(segmentButton(21))
    expect(segmentButton(21).getAttribute('data-selected')).toBeNull()
  })

  it('marks the clicked phrase, extends on the next click and opens the dialog with the window', async () => {
    renderPlayer()

    fireEvent.click(segmentButton(21))
    expect(segmentButton(21).getAttribute('data-selected')).toBe('true')
    expect(segmentButton(12).getAttribute('data-selected')).toBeNull()

    // A phrase before the picked window moves the start back (adjacent magnet).
    fireEvent.click(segmentButton(12))
    expect(segmentButton(12).getAttribute('data-selected')).toBe('true')
    expect(segmentButton(21).getAttribute('data-selected')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /Cortar trecho/ }))

    await screen.findByRole('dialog')
    expect(screen.getByText('Cortar vídeo')).toBeTruthy()
    const range = document.body.textContent ?? ''
    expect(range).toContain('00:12')
    expect(range).toContain('00:30')
  })
})
