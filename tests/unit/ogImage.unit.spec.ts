// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedGlobal: vi.fn(),
  getCachedDocumentById: vi.fn(),
}))

vi.mock('@/utilities/globalReads', () => ({
  getCachedGlobal: mocks.getCachedGlobal,
}))

vi.mock('@/utilities/documentReads', () => ({
  getCachedDocumentById: mocks.getCachedDocumentById,
}))

import type { Media } from '@/payload-types'
import { resolveOgImage } from '@/utilities/ogImageReads'

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

const media = (overrides: Partial<Media> = {}): Media =>
  ({
    id: 9,
    alt: 'Imagem padrão do site',
    url: '/api/media/file/site-default.png',
    width: 1200,
    height: 630,
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as Media

describe('resolveOgImage (single owner of the public OG fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCachedGlobal.mockReturnValue(async () => ({}))
    mocks.getCachedDocumentById.mockReturnValue(async () => null)
    process.env.NEXT_PUBLIC_SITE_URL = 'https://deploy.test'
  })

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }
  })

  it('resolves nothing when neither the page nor the global has an image', async () => {
    expect(await resolveOgImage(null)).toEqual({ url: null, media: null })
  })

  it('absolutizes a relative own URL on the deployment origin, never on the canonical global URL', async () => {
    mocks.getCachedGlobal.mockReturnValue(async () => ({
      URL: 'https://canonical.example',
      image: media(),
    }))

    expect(await resolveOgImage('/conteudos/peca/midia')).toEqual({
      url: 'https://deploy.test/conteudos/peca/midia',
      media: null,
    })
  })

  it('keeps an already absolute own URL even without a deployment origin', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    expect(await resolveOgImage('https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg')).toEqual({
      url: 'https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg',
      media: null,
    })
  })

  it('resolves an own Media upload and returns the document alongside the URL', async () => {
    const own = media({ id: 11, url: '/api/media/file/peca.png' })

    expect(await resolveOgImage(own)).toEqual({
      url: 'https://deploy.test/api/media/file/peca.png',
      media: own,
    })
  })

  it('populates an own bare id (depth-0 read) like the global fallback does', async () => {
    const own = media({ id: 11, url: '/api/media/file/peca.png' })
    mocks.getCachedDocumentById.mockReturnValue(async () => own)

    expect(await resolveOgImage(own.id)).toEqual({
      url: 'https://deploy.test/api/media/file/peca.png',
      media: own,
    })
    expect(mocks.getCachedDocumentById).toHaveBeenCalledWith('media', String(own.id))
  })

  it('falls back to the global media object when the page has no own image', async () => {
    const fallback = media()
    mocks.getCachedGlobal.mockReturnValue(async () => ({
      URL: 'https://canonical.example',
      image: fallback,
    }))

    expect(await resolveOgImage(undefined)).toEqual({
      url: 'https://deploy.test/api/media/file/site-default.png',
      media: fallback,
    })
  })

  it('populates the global fallback when the read came back with a bare id', async () => {
    const fallback = media()
    mocks.getCachedGlobal.mockReturnValue(async () => ({
      URL: 'https://canonical.example',
      image: fallback.id,
    }))
    mocks.getCachedDocumentById.mockReturnValue(async () => fallback)

    expect(await resolveOgImage(null)).toEqual({
      url: 'https://deploy.test/api/media/file/site-default.png',
      media: fallback,
    })
    expect(mocks.getCachedDocumentById).toHaveBeenCalledWith('media', String(fallback.id))
  })

  it('falls back to the global when the own Media has no usable URL', async () => {
    const fallback = media()
    mocks.getCachedGlobal.mockReturnValue(async () => ({
      URL: 'https://canonical.example',
      image: fallback,
    }))

    expect(await resolveOgImage(media({ url: null }))).toEqual({
      url: 'https://deploy.test/api/media/file/site-default.png',
      media: fallback,
    })
  })

  it('drops a relative image when there is no origin at all — never a broken preview', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    mocks.getCachedGlobal.mockReturnValue(async () => ({ image: media() }))

    expect(await resolveOgImage(null)).toEqual({ url: null, media: null })
  })
})
