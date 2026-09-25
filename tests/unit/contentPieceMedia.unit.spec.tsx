// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ContentPieceMedia } from '@/components/conteudos/ContentPieceMedia'
import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'

const item = (patch: Partial<ContentPiecePublicItem> = {}): ContentPiecePublicItem => ({
  id: 7,
  slug: 'peca-7',
  title: 'Vídeo da peça',
  type: 'video',
  typeLabel: 'Vídeo',
  origin: 'arquivo',
  originLabel: 'Arquivo',
  isLink: false,
  sourceUrl: null,
  topics: [],
  topicLabels: [],
  cityLabel: null,
  regionLabel: null,
  institution: null,
  leaderNames: [],
  publicFigures: [],
  description: null,
  excerpt: null,
  durationLabel: '02:14',
  pieceDateLabel: null,
  metaLabel: 'Tema · Local',
  searchText: '',
  themeMatch: null,
  publicPath: '/conteudos/peca-7',
  file: {
    id: 107,
    path: '/conteudos/peca-7/midia',
    mimeType: 'video/mp4',
    downloadFilename: 'peca-7.mp4',
  },
  framePath: '/conteudos/peca-7/frame',
  ...patch,
})

const renderSlot = (
  overrides: Partial<ContentPiecePublicItem>,
  playing = false,
  variant: 'card' | 'thumb' | 'detail' | 'home-thumb' = 'card',
) =>
  render(
    <ContentPieceMedia
      item={item(overrides)}
      playing={playing}
      onToggle={vi.fn()}
      onEnded={vi.fn()}
      variant={variant}
    />,
  )

/** The play state belongs to the host, so the slot is driven by re-rendering. */
const playSlot = (view: { rerender: (ui: React.ReactElement) => void }, playing: boolean) =>
  view.rerender(
    <ContentPieceMedia item={item()} playing={playing} onToggle={vi.fn()} onEnded={vi.fn()} />,
  )

const frameImage = () =>
  document.querySelector<HTMLImageElement>('img[src="/conteudos/peca-7/frame"]')

afterEach(cleanup)

describe('ContentPieceMedia — the video still before the play (C226)', () => {
  it('asks for the frame, never for the video file, before the gesture', () => {
    renderSlot({})

    expect(frameImage()).not.toBeNull()
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelector('audio')).toBeNull()
    // S27: the element that would fetch the file only exists after the tap.
    expect(document.querySelector('[src="/conteudos/peca-7/midia"]')).toBeNull()
  })

  it('keeps the frame out of the slot once the piece is playing', () => {
    renderSlot({}, true)

    expect(frameImage()).toBeNull()
    const video = document.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('preload')).toBe('none')
    expect(video?.getAttribute('src')).toBe('/conteudos/peca-7/midia')
  })

  it('falls back to the neutral slot with the designed marker when there is no frame', () => {
    renderSlot({ framePath: null })

    expect(frameImage()).toBeNull()
    expect(screen.getByText('Frame indisponível')).toBeDefined()
    // The piece type still reads on the card body tag, not inside the slot.
    expect(document.querySelector('video')).toBeNull()
  })

  it('never retries a broken frame: the marker replaces it for the life of the card', () => {
    renderSlot({})
    const image = frameImage()
    if (!image) throw new Error('the still was not rendered')

    fireEvent.error(image)
    expect(frameImage()).toBeNull()
    expect(screen.getByText('Frame indisponível')).toBeDefined()
    // No broken image is left in the DOM and no second request was made.
    expect(document.querySelector('img')).toBeNull()
  })

  it('keeps the still invisible until it decodes (no broken-image glyph ever)', () => {
    renderSlot({})
    const image = frameImage()
    if (!image) throw new Error('the still was not rendered')

    // Loading: the neutral surface is what the visitor sees — the image never
    // paints over it before the browser decodes it.
    expect(image.className).toContain('opacity-0')
    expect(screen.queryByText('Frame indisponível')).toBeNull()

    fireEvent.load(image)
    expect(image.className).not.toContain('opacity-0')
  })

  /**
   * The browser fires neither `load` nor `error` again for an image that
   * already settled before hydration — the ref is the only thing that can tell
   * a decoded still from a failed one, and both outcomes are the fast path.
   */
  const withSettledImage = (naturalWidth: number, run: () => void) => {
    const complete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'complete')
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
      configurable: true,
      get: () => naturalWidth,
    })
    try {
      run()
    } finally {
      if (complete) {
        Object.defineProperty(HTMLImageElement.prototype, 'complete', complete)
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).complete
      }
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth
    }
  }

  it('shows a still that was already decoded before hydration (warm cache)', () => {
    withSettledImage(640, () => {
      renderSlot({})
      const image = frameImage()
      if (!image) throw new Error('the still was not rendered')
      expect(image.className).not.toContain('opacity-0')
    })
  })

  it('falls back when the still had already failed before hydration', () => {
    withSettledImage(0, () => {
      renderSlot({})
      expect(frameImage()).toBeNull()
      expect(screen.getByText('Frame indisponível')).toBeDefined()
    })
  })

  it('never asks again after a play/stop cycle (the state outlives the layer)', () => {
    const view = renderSlot({})
    const still = frameImage()
    if (!still) throw new Error('the still was not rendered')

    fireEvent.error(still)
    playSlot(view, true)
    playSlot(view, false)

    // The knowledge that this piece has no frame belongs to the card, not to
    // the layer that remounts on every play — so the still is never requested
    // a second time.
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('Frame indisponível')).toBeDefined()
  })

  it('keeps an audio piece exactly as it was (no frame, no marker)', () => {
    renderSlot({
      type: 'audio',
      typeLabel: 'Áudio',
      framePath: null,
      file: {
        id: 107,
        path: '/conteudos/peca-7/midia',
        mimeType: 'audio/mpeg',
        downloadFilename: 'peca-7.mp3',
      },
    })

    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByText('Frame indisponível')).toBeNull()
    expect(screen.getByText('Áudio')).toBeDefined()
  })

  it('drops the marker on the 124px home thumb and shrinks the play (CENA 05)', () => {
    renderSlot({ framePath: null }, false, 'home-thumb')

    // The neutral surface IS the message there: the marker would crowd the play.
    // The compact classes stay in the DOM for the `sm` breakpoint, where that
    // card becomes a full block and the full treatment returns.
    const marker = screen.getByText('Frame indisponível').closest('span')
    expect(marker?.className).toContain('hidden')
    expect(marker?.className).toContain('sm:flex')
    expect(document.querySelector('button[aria-label^="Reproduzir"]')?.className).toContain(
      'size-11',
    )
    expect(document.querySelector('span.rounded.bg-black\\/70')?.className).toContain('text-[10px]')
  })

  it('keeps the full marker on the catalogue card', () => {
    renderSlot({ framePath: null })

    const marker = screen.getByText('Frame indisponível').closest('span')
    expect(marker?.className).toContain('flex')
    expect(marker?.className).not.toContain('hidden')
  })

  it('keeps the marker and its 28px glyph on the piece page', () => {
    renderSlot({ framePath: null }, false, 'detail')

    expect(screen.getByText('Frame indisponível')).toBeDefined()
    expect(document.querySelector('span.grid.size-7')).not.toBeNull()
  })

  it('gives a photo piece no frame at all', () => {
    renderSlot({
      type: 'foto',
      typeLabel: 'Foto',
      framePath: null,
      file: {
        id: 107,
        path: '/conteudos/peca-7/midia',
        mimeType: 'image/png',
        downloadFilename: 'peca-7.png',
      },
    })

    expect(document.querySelectorAll('img')).toHaveLength(1)
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/conteudos/peca-7/midia')
  })
})
