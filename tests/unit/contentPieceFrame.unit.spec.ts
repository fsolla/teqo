// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { contentPieceFramePath } from '@/lib/contentPieceCatalog'
import {
  buildContentPieceFrameFfmpegArgs,
  CONTENT_PIECE_FRAME_MAX_SOURCE_BYTES,
  CONTENT_PIECE_FRAME_SEEK_ATTEMPTS,
  CONTENT_PIECE_FRAME_WAIT_MS,
  contentPieceFrameFilename,
  contentPieceFrameMediaAlt,
  contentPieceFrameSizeAllowed,
} from '@/lib/contentPieceFrame'

describe('contentPieceFrameFilename / contentPieceFramePath', () => {
  it('is deterministic and unique per piece (the idempotence key)', () => {
    expect(contentPieceFrameFilename(42)).toBe('content-piece-frame-42.jpg')
    expect(contentPieceFrameFilename(43)).toBe('content-piece-frame-43.jpg')
  })

  it('lives beside the media route of the same public piece', () => {
    expect(contentPieceFramePath('peca-de-video')).toBe('/conteudos/peca-de-video/frame')
  })
})

describe('contentPieceFrameMediaAlt', () => {
  it('describes the derived row (contentMedia.alt is required)', () => {
    expect(contentPieceFrameMediaAlt('Voto 1313')).toBe('Frame do vídeo «Voto 1313»')
  })
})

describe('contentPieceFrameSizeAllowed', () => {
  it('refuses a source the self-heal would have to download whole', () => {
    expect(contentPieceFrameSizeAllowed(1024)).toBe(true)
    expect(contentPieceFrameSizeAllowed(CONTENT_PIECE_FRAME_MAX_SOURCE_BYTES)).toBe(true)
    expect(contentPieceFrameSizeAllowed(CONTENT_PIECE_FRAME_MAX_SOURCE_BYTES + 1)).toBe(false)
  })

  it('does not skip on an unknown size (a projection limit is not a licence)', () => {
    expect(contentPieceFrameSizeAllowed(null)).toBe(true)
    expect(contentPieceFrameSizeAllowed(undefined)).toBe(true)
    expect(contentPieceFrameSizeAllowed(Number.NaN)).toBe(true)
  })
})

describe('buildContentPieceFrameFfmpegArgs', () => {
  it('seeks to the second and takes a single scaled jpeg frame', () => {
    const args = buildContentPieceFrameFfmpegArgs({
      inputPath: '/tmp/source.mp4',
      outputPath: '/tmp/content-piece-frame-42.jpg',
      atSeconds: 1,
    })

    expect(args).toEqual([
      '-nostdin',
      '-hide_banner',
      '-y',
      '-ss',
      '1',
      '-i',
      '/tmp/source.mp4',
      '-frames:v',
      '1',
      '-vf',
      'scale=640:-2',
      '-q:v',
      '3',
      '-an',
      '/tmp/content-piece-frame-42.jpg',
    ])
    // The seek is an input option: before `-i`, never after — and the command
    // is an argv array, never a shell string (the `toEqual` above is the pin).
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
  })

  it('never seeks to a negative instant', () => {
    const args = buildContentPieceFrameFfmpegArgs({
      inputPath: 'in.mp4',
      outputPath: 'out.jpg',
      atSeconds: -3,
    })

    expect(args[args.indexOf('-ss') + 1]).toBe('0')
  })
})

describe('CONTENT_PIECE_FRAME_SEEK_ATTEMPTS', () => {
  it('avoids the black opening frame and retries once at zero', () => {
    expect([...CONTENT_PIECE_FRAME_SEEK_ATTEMPTS]).toEqual([1, 0])
  })
})

describe('CONTENT_PIECE_FRAME_WAIT_MS', () => {
  it('is shorter than the acervo poster wait (here the heal may download the file)', () => {
    expect(CONTENT_PIECE_FRAME_WAIT_MS).toBeLessThan(20_000)
  })
})
