// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  canServeReelMedia,
  isReelMediaKind,
  isReelStatus,
  REEL_FEATURES,
  REEL_MEDIA_BLOCKED_LABEL,
  REEL_MEDIA_DRAFT_LABEL,
  REEL_MEDIA_KINDS,
  REEL_STATUSES,
  reelDownloadUnavailableLabels,
  reelFeatureLabels,
  reelMediaFieldByKind,
  reelMediaPath,
  reelStatusLabels,
  toReelDetailViewModel,
  toReelLibraryItemViewModel,
  type ReelRecordForView,
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

const baseRecord: ReelRecordForView = {
  id: 42,
  title: 'Como criar seu card de apoio',
  feature: 'cards',
  status: 'published',
  publishedAt: '2026-09-18T17:00:00.000Z',
  transcript: '  [Abertura] Quer mostrar que está com Solla?  ',
  video: { alt: 'Vídeo do tutorial' },
  cover: { alt: 'Capa do tutorial' },
}

describe('reel view models (C194)', () => {
  it('builds the library card with the private media paths', () => {
    const item = toReelLibraryItemViewModel(baseRecord)

    expect(item).toEqual({
      id: 42,
      title: 'Como criar seu card de apoio',
      featureLabel: 'Cards de apoio',
      status: 'published',
      statusLabel: 'Publicado',
      coverUrl: '/campanha/comunicacao/reels/42/media/cover',
      coverAlt: 'Capa do tutorial',
      publishedAtLabel: '18/09/2026',
      detailHref: '/campanha/comunicacao/reels/42',
    })
  })

  it('falls back to the title when the cover is an id and to the raw feature when unknown', () => {
    const item = toReelLibraryItemViewModel({
      ...baseRecord,
      feature: 'wallpapers',
      cover: 7,
    })

    expect(item.coverAlt).toBe('Como criar seu card de apoio')
    expect(item.featureLabel).toBe('wallpapers')
  })

  it('offers the primary silent video and the existing variants as downloads', () => {
    const detail = toReelDetailViewModel({
      ...baseRecord,
      videoWithAudio: { alt: 'Rascunho' },
    })

    expect(detail.canServeMedia).toBe(true)
    expect(detail.videoSourceUrl).toBe('/campanha/comunicacao/reels/42/media/video-audio')
    expect(detail.videoPosterUrl).toBe('/campanha/comunicacao/reels/42/media/cover')
    expect(detail.transcript).toBe('[Abertura] Quer mostrar que está com Solla?')
    expect(detail.downloads.map((item) => item.kind)).toEqual([
      'video',
      'video-audio',
      'narration',
      'captions',
    ])
    const [video, withAudio, narration, captions] = detail.downloads
    expect(video).toMatchObject({
      primary: true,
      href: '/campanha/comunicacao/reels/42/media/video?download=1',
      unavailableLabel: null,
    })
    expect(withAudio).toMatchObject({
      href: '/campanha/comunicacao/reels/42/media/video-audio?download=1',
      unavailableLabel: null,
    })
    expect(narration.href).toBeNull()
    expect(narration.unavailableLabel).toBe(reelDownloadUnavailableLabels.narration)
    expect(captions.href).toBeNull()
    expect(captions.unavailableLabel).toBe(reelDownloadUnavailableLabels.captions)
  })

  it('withholds player and downloads while the kill switch is off (C193 decision B)', () => {
    const detail = toReelDetailViewModel({
      ...baseRecord,
      status: 'unpublished',
      videoWithAudio: { alt: 'Rascunho' },
      narrationAudio: { alt: 'Narração' },
    })

    expect(detail.canServeMedia).toBe(false)
    expect(detail.videoSourceUrl).toBeNull()
    expect(detail.transcript).toBe('[Abertura] Quer mostrar que está com Solla?')
    expect(detail.mediaBlockedLabel).toBe(REEL_MEDIA_BLOCKED_LABEL)
    for (const item of detail.downloads) {
      expect(item.href).toBeNull()
      expect(item.unavailableLabel).toBe(REEL_MEDIA_BLOCKED_LABEL)
    }
  })

  it('tells a draft the files arrive with the first publication, not a republication', () => {
    const detail = toReelDetailViewModel({ ...baseRecord, status: 'draft' })

    expect(detail.canServeMedia).toBe(false)
    expect(detail.mediaBlockedLabel).toBe(REEL_MEDIA_DRAFT_LABEL)
    expect(detail.downloads.every((item) => item.unavailableLabel === REEL_MEDIA_DRAFT_LABEL)).toBe(
      true,
    )
  })
})
