// @vitest-environment node

/**
 * S19 — `shareLink`: slug validation (format, reserved, duplicate), destination
 * validation (http/https only), slugify fallback, the fail-closed `published`
 * switch for anonymous reads, the slug-keyed public loader and the listing cache
 * tag busted by afterChange/afterDelete.
 */
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidateTagMock, getCachedGlobalMock } = vi.hoisted(() => ({
  revalidateTagMock: vi.fn(),
  getCachedGlobalMock: vi.fn(),
}))

// The collection hooks bust the Next cache tag; the loader reaches
// `unstable_cache`. Both need the Next runtime, so mock it — the assertion
// pins the tag name.
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: revalidateTagMock,
  unstable_cache: (fn: unknown) => fn,
}))

// The site-default image fallback reads the shared `metadata` global; mocking
// the read lets the test exercise it without writing a global the rest of the
// suite (int and e2e share `teqo_wt19_test`) also consumes.
vi.mock('@/utilities/globalReads', () => ({
  getCachedGlobal: getCachedGlobalMock,
}))

import {
  SHARE_LINK_DESTINATION_INVALID_MESSAGE,
  SHARE_LINK_SLUG_DUPLICATE_MESSAGE,
  SHARE_LINK_SLUG_INVALID_MESSAGE,
  SHARE_LINK_SLUG_RESERVED_MESSAGE,
} from '@/lib/shareLink'
import config from '@/payload.config'
import {
  getCachedPublishedShareLinkBySlug,
  resolveShareLinkOgImageUrl,
} from '@/utilities/shareLinkReads'

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

let payload: Payload
const createdIds = new Set<number>()
const createdMediaIds = new Set<number>()

type ShareLinkInput = {
  title: string
  slug: string
  destination: string
  description: string
  image?: number
  published?: boolean
}

const createShareLink = async (data: ShareLinkInput) => {
  const doc = await payload.create({ collection: 'shareLink', data })
  createdIds.add(doc.id)
  return doc
}

const findAnonymous = (slug: string) =>
  payload.find({
    collection: 'shareLink',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })

/**
 * Payload wraps a field `validate` message in a generic ValidationError; the
 * pt-BR message travels in `data.errors[].message`.
 */
const createErrorMessages = async (data: ShareLinkInput): Promise<string[]> => {
  try {
    const doc = await payload.create({ collection: 'shareLink', data })
    createdIds.add(doc.id)
  } catch (error) {
    const entries =
      (error as { data?: { errors?: Array<{ message?: string }> } }).data?.errors ?? []
    return entries.map((entry) => entry.message ?? '')
  }

  return []
}

describe('shareLink', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(() => {
    revalidateTagMock.mockClear()
    getCachedGlobalMock.mockReset()
    // `resolveSiteMetadata` falls back to this env when the global has no URL.
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test'
  })

  afterAll(async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    for (const id of createdIds) {
      await payload.delete({ collection: 'shareLink', id }).catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload.delete({ collection: 'media', id }).catch(() => undefined)
    }
  })

  it('creates a draft by default and busts the shareLinks tag', async () => {
    const doc = await createShareLink({
      title: 'Plenária da saúde',
      slug: 'plenaria-saude',
      destination: 'https://meet.google.com/abc-defg-hij',
      description: 'Participe da plenária sobre saúde.',
    })

    expect(doc.published).toBe(false)
    expect(revalidateTagMock).toHaveBeenCalledWith('shareLinks')
  })

  it('generates the slug from the title when empty', async () => {
    const doc = await createShareLink({
      title: 'Plenária da Saúde em Feira',
      slug: '',
      destination: 'https://meet.google.com/abc-defg-hij',
      description: 'Participe.',
    })

    expect(doc.slug).toBe('plenaria-da-saude-em-feira')
  })

  it('trims the destination', async () => {
    const doc = await createShareLink({
      title: 'Reunião',
      slug: 'reuniao-trim',
      destination: '  https://meet.google.com/abc-defg-hij  ',
      description: 'Participe.',
    })

    expect(doc.destination).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('rejects a reserved slug with a clear message', async () => {
    const messages = await createErrorMessages({
      title: 'Corte',
      slug: 'corte',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    expect(messages).toContain(SHARE_LINK_SLUG_RESERVED_MESSAGE)
  })

  it.each([
    ['Plenaria', 'plenaria'],
    ['plenaria da saude', 'plenaria-da-saude'],
    ['plenaria--feira', 'plenaria-feira'],
    ['plenaria.2026', 'plenaria-2026'],
  ])('normalizes the slug %s to %s', async (input, expected) => {
    const doc = await createShareLink({
      title: 'Plenária',
      slug: input,
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    expect(doc.slug).toBe(expected)
  })

  it('rejects a slug that resolves to nothing with a clear message', async () => {
    const messages = await createErrorMessages({
      title: 'Plenária',
      slug: '---',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    expect(messages).toContain(SHARE_LINK_SLUG_INVALID_MESSAGE)
  })

  it('rejects a duplicate slug with a clear message', async () => {
    await createShareLink({
      title: 'Primeira',
      slug: 'slug-unico-s19',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    const messages = await createErrorMessages({
      title: 'Segunda',
      slug: 'slug-unico-s19',
      destination: 'https://meet.google.com/def',
      description: 'y',
    })

    expect(messages).toContain(SHARE_LINK_SLUG_DUPLICATE_MESSAGE)
  })

  it.each(['meet.google.com/abc', 'ftp://example.com/x', 'javascript:alert(1)'])(
    'rejects the invalid destination %s',
    async (destination) => {
      const messages = await createErrorMessages({
        title: 'Plenária',
        slug: `destino-invalido-${Buffer.from(destination).toString('hex').slice(0, 12)}`,
        destination,
        description: 'x',
      })

      expect(messages).toContain(SHARE_LINK_DESTINATION_INVALID_MESSAGE)
    },
  )

  it('hides drafts from anonymous reads and exposes them once published', async () => {
    const draft = await createShareLink({
      title: 'Rascunho',
      slug: 'rascunho-s19',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    expect((await findAnonymous('rascunho-s19')).totalDocs).toBe(0)
    expect(await getCachedPublishedShareLinkBySlug('rascunho-s19')()).toBeNull()

    await payload.update({ collection: 'shareLink', id: draft.id, data: { published: true } })

    expect((await findAnonymous('rascunho-s19')).totalDocs).toBe(1)
    const loaded = await getCachedPublishedShareLinkBySlug('rascunho-s19')()
    expect(loaded?.id).toBe(draft.id)
  })

  it('busts the tag on update and delete', async () => {
    const doc = await createShareLink({
      title: 'Ciclo',
      slug: 'ciclo-s19',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })

    revalidateTagMock.mockClear()
    await payload.update({ collection: 'shareLink', id: doc.id, data: { published: true } })
    expect(revalidateTagMock).toHaveBeenCalledWith('shareLinks')

    revalidateTagMock.mockClear()
    await payload.delete({ collection: 'shareLink', id: doc.id })
    createdIds.delete(doc.id)
    expect(revalidateTagMock).toHaveBeenCalledWith('shareLinks')
  })

  it('resolves the configured image and falls back to the site default', async () => {
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Imagem do link' },
      file: {
        data: TEST_PNG,
        mimetype: 'image/png',
        name: `share-link-int-${Date.now()}.png`,
        size: TEST_PNG.length,
      },
      overrideAccess: true,
    })
    createdMediaIds.add(media.id)
    const expectedUrl = `https://site.test${media.url}`

    const withImage = await createShareLink({
      title: 'Com imagem',
      slug: 'imagem-configurada-s19',
      destination: 'https://meet.google.com/abc',
      description: 'x',
      image: media.id,
    })
    const populated = await payload.findByID({
      collection: 'shareLink',
      id: withImage.id,
      depth: 1,
    })
    getCachedGlobalMock.mockReturnValue(async () => ({}))
    expect(await resolveShareLinkOgImageUrl(populated)).toBe(expectedUrl)

    const withoutImage = await createShareLink({
      title: 'Sem imagem',
      slug: 'imagem-fallback-s19',
      destination: 'https://meet.google.com/abc',
      description: 'x',
    })
    // No site default configured: no image at all — never a relative/broken one.
    expect(await resolveShareLinkOgImageUrl(withoutImage)).toBeNull()

    getCachedGlobalMock.mockReturnValue(async () => ({
      image: { url: '/api/media/file/site-default.png' },
    }))
    expect(await resolveShareLinkOgImageUrl(withoutImage)).toBe(
      'https://site.test/api/media/file/site-default.png',
    )
  })
})
