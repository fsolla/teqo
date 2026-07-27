// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SITE_METADATA_DEFAULTS } from '@/utilities/seo'

const mocks = vi.hoisted(() => ({
  getCachedGlobal: vi.fn(),
  getCachedDocumentById: vi.fn(),
  getCachedPostBySlug: vi.fn(),
  extractFirstImageFromLexical: vi.fn(() => null),
}))

vi.mock('@/utilities/globalReads', () => ({
  getCachedGlobal: mocks.getCachedGlobal,
}))

vi.mock('@/utilities/documentReads', () => ({
  getCachedDocumentById: mocks.getCachedDocumentById,
  getPetitionIds: vi.fn(async () => []),
}))

vi.mock('@/utilities/extractFirstImageFromLexical', () => ({
  extractFirstImageFromLexical: mocks.extractFirstImageFromLexical,
}))

vi.mock('@/utilities/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utilities/posts')>()
  return {
    ...actual,
    getCachedPostBySlug: mocks.getCachedPostBySlug,
    getVisiblePosts: vi.fn(async () => []),
  }
})

vi.mock('@/app/(frontend)/actions/getSignatureCount', () => ({
  getSignatureCount: vi.fn(async () => 0),
}))

import { generateMetadata as generateArticleMetadata } from '@/app/(frontend)/[type]/[category]/[slug]/page'
import { generateMetadata as generatePetitionMetadata } from '@/app/(frontend)/abaixo-assinado/[id]/page'

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

const enabledPetition = {
  id: 42,
  enabled: true,
  title: 'Petição de teste',
  subtitle: 'Subtítulo da petição de teste com texto suficiente.',
  body: {
    root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 },
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

const visiblePost = {
  id: 7,
  title: 'Notícia de teste',
  subtitle: 'Subtítulo da notícia',
  slug: 'noticia-de-teste',
  type: 'noticia' as const,
  _status: 'published' as const,
  category: { id: 1, name: 'Saúde', slug: 'saude', hidden: false },
  tags: [],
  body: null,
  coverImage: null,
  publishedDate: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

describe('site metadata fallback (empty global)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCachedGlobal.mockReturnValue(async () => ({}))
    mocks.getCachedDocumentById.mockImplementation((collection: string) => {
      if (collection === 'petition') return async () => enabledPetition
      return async () => null
    })
    mocks.getCachedPostBySlug.mockReturnValue(async () => visiblePost)
  })

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
    }
  })

  it('generateMetadata for abaixo-assinado survives an empty metadata global', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    const metadata = await generatePetitionMetadata({
      params: Promise.resolve({ id: '42' }),
    })

    expect(metadata.title).toBe(`Petição de teste | ${SITE_METADATA_DEFAULTS.siteName}`)
    expect(metadata.alternates?.canonical).toBeUndefined()
    expect(metadata.openGraph?.url).toBeUndefined()
    expect(metadata.openGraph?.siteName).toBe(SITE_METADATA_DEFAULTS.siteName)
    expect(metadata.twitter?.creator).toBe(SITE_METADATA_DEFAULTS.twitterCreator)
  })

  it('generateMetadata for article survives an empty metadata global', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    const metadata = await generateArticleMetadata({
      params: Promise.resolve({
        type: 'noticia',
        category: 'saude',
        slug: 'noticia-de-teste',
      }),
    })

    expect(metadata.title).toBe(`Notícia de teste | ${SITE_METADATA_DEFAULTS.siteName}`)
    expect(metadata.alternates?.canonical).toBeUndefined()
    expect(metadata.openGraph?.url).toBeUndefined()
    expect(metadata.openGraph?.siteName).toBe(SITE_METADATA_DEFAULTS.siteName)
  })

  it('uses NEXT_PUBLIC_SITE_URL for canonical when the global has no URL', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://fallback.example/'

    const metadata = await generatePetitionMetadata({
      params: Promise.resolve({ id: '42' }),
    })

    expect(metadata.alternates?.canonical).toBe('https://fallback.example/abaixo-assinado/42')
    expect(metadata.openGraph?.url).toBe('https://fallback.example/abaixo-assinado/42')
  })
})
