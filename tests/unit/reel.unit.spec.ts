// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  canServeReelMedia,
  isReelMediaKind,
  isReelStatus,
  REEL_FEATURES,
  REEL_MEDIA_KINDS,
  REEL_STATUSES,
  reelFeatureLabels,
  reelMediaFieldByKind,
  reelMediaPath,
  reelStatusLabels,
} from '@/lib/reel'
import {
  REEL_MEDIA_FALLBACK_MIME_TYPE,
  reelMediaContentDisposition,
  reelMediaContentType,
  reelMediaHeaders,
  type ReelMediaRange,
} from '@/lib/reelMedia'

const fullRange: ReelMediaRange = {
  status: 200,
  headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '100' },
}

const partialRange: ReelMediaRange = {
  status: 206,
  headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '10', 'Content-Range': 'bytes 0-9/100' },
}

const invalidRange: ReelMediaRange = {
  status: 416,
  headers: { 'Content-Range': 'bytes */100' },
}

describe('reel vocabulary (C193)', () => {
  it('pins the status kill switch and its labels', () => {
    expect(REEL_STATUSES).toEqual(['draft', 'published', 'unpublished'])
    expect(Object.keys(reelStatusLabels).sort()).toEqual([...REEL_STATUSES].sort())
    expect(isReelStatus('published')).toBe(true)
    expect(isReelStatus('processing')).toBe(false)
  })

  it('pins the closed feature catalog starting at cards', () => {
    expect(REEL_FEATURES).toEqual(['cards'])
    expect(Object.keys(reelFeatureLabels).sort()).toEqual([...REEL_FEATURES].sort())
  })

  it('maps every artifact kind to exactly one upload field', () => {
    expect(REEL_MEDIA_KINDS).toEqual(['video', 'video-audio', 'narration', 'captions', 'cover'])
    expect(Object.keys(reelMediaFieldByKind).sort()).toEqual([...REEL_MEDIA_KINDS].sort())
    expect(new Set(Object.values(reelMediaFieldByKind)).size).toBe(REEL_MEDIA_KINDS.length)
    expect(reelMediaFieldByKind.video).toBe('video')
    expect(isReelMediaKind('captions')).toBe(true)
    expect(isReelMediaKind('poster')).toBe(false)
  })

  it('serves only a published reel and builds the cookie-scoped path', () => {
    expect(canServeReelMedia('published')).toBe(true)
    expect(canServeReelMedia('draft')).toBe(false)
    expect(canServeReelMedia('unpublished')).toBe(false)
    expect(reelMediaPath(42, 'video')).toBe('/campanha/comunicacao/reels/42/media/video')
  })
})

describe('reel media response rules (C193)', () => {
  it('serves only allowlisted types inline; everything else degrades', () => {
    expect(reelMediaContentType('video/mp4')).toBe('video/mp4')
    expect(reelMediaContentType('audio/mpeg')).toBe('audio/mpeg')
    expect(reelMediaContentType('image/jpeg')).toBe('image/jpeg')
    expect(reelMediaContentType('text/html')).toBe(REEL_MEDIA_FALLBACK_MIME_TYPE)
    expect(reelMediaContentType(null)).toBe(REEL_MEDIA_FALLBACK_MIME_TYPE)
  })

  it('builds both filename forms and encodes non-ASCII', () => {
    expect(reelMediaContentDisposition('reel.mp4', false)).toBe(
      'inline; filename="reel.mp4"; filename*=UTF-8\'\'reel.mp4',
    )
    expect(reelMediaContentDisposition('capa ção.png', true)).toBe(
      'attachment; filename="capa_o.png"; filename*=UTF-8\'\'capa%20%C3%A7%C3%A3o.png',
    )
    expect(reelMediaContentDisposition(null, false)).toContain('filename="arquivo"')
  })

  it('keeps the range headers and adds the private streaming contract', () => {
    const headers = reelMediaHeaders({
      range: partialRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: false,
    })
    expect(headers.get('Content-Range')).toBe('bytes 0-9/100')
    expect(headers.get('Content-Length')).toBe('10')
    expect(headers.get('Accept-Ranges')).toBe('bytes')
    expect(headers.get('Content-Type')).toBe('video/mp4')
    expect(headers.get('Content-Disposition')).toContain('inline')
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Content-Security-Policy')).toBeNull()
  })

  it('forces a download for unsafe types and for ?download=1', () => {
    const unsafe = reelMediaHeaders({
      range: fullRange,
      mimeType: 'text/html',
      filename: 'roteiro.html',
      download: false,
    })
    expect(unsafe.get('Content-Type')).toBe(REEL_MEDIA_FALLBACK_MIME_TYPE)
    expect(unsafe.get('Content-Disposition')).toContain('attachment')
    expect(unsafe.get('Content-Security-Policy')).toBe("default-src 'none'")

    const explicit = reelMediaHeaders({
      range: fullRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: true,
    })
    expect(explicit.get('Content-Disposition')).toContain('attachment')
  })

  it('passes the 416 headers through untouched', () => {
    const headers = reelMediaHeaders({
      range: invalidRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: false,
    })
    expect(headers.get('Content-Range')).toBe('bytes */100')
    expect(headers.get('Content-Type')).toBe('video/mp4')
  })
})
