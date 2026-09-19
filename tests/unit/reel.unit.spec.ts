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
