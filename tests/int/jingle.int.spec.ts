// @vitest-environment node

/**
 * S21 — `jingle`: slug fallback, required cover/audio, the fail-closed
 * `published` switch for anonymous reads and campaign users, the ordered
 * public listing (order asc, unordered last, title as tiebreak), the media
 * resolution used by the cards and the listing tag busted by
 * afterChange/afterDelete.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }))

// The collection hooks bust the Next cache tag; the loaders reach
// `unstable_cache`. Both need the Next runtime, so mock it — the assertion
// pins the tag name.
vi.mock('next/cache', () => ({
  revalidatePath: () => undefined,
  revalidateTag: revalidateTagMock,
  unstable_cache: (fn: unknown) => fn,
}))

import config from '@/payload.config'
import { getPublishedJingleItems, hasPublishedJingles } from '@/utilities/jingleReads'

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const TEST_MP3 = readFileSync(path.resolve(process.cwd(), 'tests/fixtures/jingle-tone.mp3'))

let payload: Payload
const createdJingleIds = new Set<number>()
const createdMediaIds = new Set<number>()
const createdUserIds = new Set<number>()
const createdCampaignUserIds = new Set<number>()

const run = () => randomUUID().slice(0, 8)

const createMedia = async (name: string, mimetype: string, data: Buffer) => {
  const media = await payload.create({
    collection: 'media',
    data: { alt: name },
    file: { data, mimetype, name, size: data.length },
    overrideAccess: true,
  })
  createdMediaIds.add(media.id)
  return media
}

type JingleInput = {
  title: string
  slug?: string
  order?: number | null
  published?: boolean
}

const createJingle = async ({ title, slug, order = null, published = false }: JingleInput) => {
  const suffix = `${run()}-${slug || 'auto'}`
  const cover = await createMedia(`capa-${suffix}.png`, 'image/png', TEST_PNG)
  const audio = await createMedia(`audio-${suffix}.mp3`, 'audio/mpeg', TEST_MP3)
  const doc = await payload.create({
    collection: 'jingle',
    data: {
      title,
      ...(slug !== undefined ? { slug } : {}),
      coverImage: cover.id,
      audio: audio.id,
      order,
      published,
    },
  })
  createdJingleIds.add(doc.id)
  return { doc, cover, audio }
}

const findAnonymous = () =>
  payload.find({ collection: 'jingle', depth: 0, limit: 0, overrideAccess: false })

describe('jingle', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  beforeEach(() => {
    revalidateTagMock.mockClear()
  })

  afterAll(async () => {
    for (const id of createdJingleIds) {
      await payload.delete({ collection: 'jingle', id }).catch(() => undefined)
    }
    for (const id of createdMediaIds) {
      await payload.delete({ collection: 'media', id }).catch(() => undefined)
    }
    for (const id of createdUserIds) {
      await payload.delete({ collection: 'users', id }).catch(() => undefined)
    }
    for (const id of createdCampaignUserIds) {
      await payload.delete({ collection: 'campaignUser', id }).catch(() => undefined)
    }
  })

  it('creates unpublished by default and busts the jingles tag', async () => {
    const { doc } = await createJingle({ title: 'Axe', slug: 'axe' })

    expect(doc.published).toBe(false)
    expect(revalidateTagMock).toHaveBeenCalledWith('jingles')
  })

  it('generates the slug from the title when empty', async () => {
    const { doc } = await createJingle({ title: 'Forró' })

    expect(doc.slug).toBe('forro')
  })

  it('rejects a title whose slug normalizes to nothing', async () => {
    const cover = await createMedia(`capa-slug-vazio-${run()}.png`, 'image/png', TEST_PNG)
    const audio = await createMedia(`audio-slug-vazio-${run()}.mp3`, 'audio/mpeg', TEST_MP3)

    try {
      const doc = await payload.create({
        collection: 'jingle',
        data: { title: '♥♥', coverImage: cover.id, audio: audio.id },
      })
      createdJingleIds.add(doc.id)
      throw new Error('expected the create to be rejected')
    } catch (error) {
      // Payload wraps a field validation in a generic message; the pt-BR
      // message travels in `data.errors[].message`.
      const entries =
        (error as { data?: { errors?: Array<{ message?: string }> } }).data?.errors ?? []
      expect(entries.map((entry) => entry.message ?? '').join(' ')).toContain('letras ou números')
    }
  })

  it('requires both the cover and the audio', async () => {
    const cover = await createMedia(`capa-obrigatoria-${run()}.png`, 'image/png', TEST_PNG)
    const audio = await createMedia(`audio-obrigatorio-${run()}.mp3`, 'audio/mpeg', TEST_MP3)

    await expect(
      // @ts-expect-error Testing the runtime rejection of a missing required cover
      payload.create({
        collection: 'jingle',
        data: { title: 'Sem capa', audio: audio.id, published: true },
      }),
    ).rejects.toThrow()
    await expect(
      // @ts-expect-error Testing the runtime rejection of a missing required audio
      payload.create({
        collection: 'jingle',
        data: { title: 'Sem áudio', coverImage: cover.id, published: true },
      }),
    ).rejects.toThrow()
  })

  it('hides drafts from anonymous reads and from the public listing, exposing them once published', async () => {
    const { doc } = await createJingle({ title: 'Rascunho', slug: 'rascunho-s21' })

    expect((await findAnonymous()).docs.some((row) => row.id === doc.id)).toBe(false)
    expect((await getPublishedJingleItems()).some((item) => item.id === doc.id)).toBe(false)

    await payload.update({ collection: 'jingle', id: doc.id, data: { published: true } })

    expect((await findAnonymous()).docs.some((row) => row.id === doc.id)).toBe(true)
    expect((await getPublishedJingleItems()).some((item) => item.id === doc.id)).toBe(true)
    expect(await hasPublishedJingles()).toBe(true)
  })

  it('refuses to write as a campaign user and allows an editor', async () => {
    const campaignUser = await payload.create({
      collection: 'campaignUser',
      data: {
        name: 'Coordenação',
        email: `jingle-int-${run()}@example.com`,
        password: 'password',
        role: 'coordinator',
      },
      depth: 0,
    })
    createdCampaignUserIds.add(campaignUser.id)
    const editor = await payload.create({
      collection: 'users',
      data: {
        email: `jingle-int-editor-${run()}@example.com`,
        password: 'password',
        roles: ['editor'],
      },
      depth: 0,
    })
    createdUserIds.add(editor.id)

    const cover = await createMedia(`capa-acesso-${run()}.png`, 'image/png', TEST_PNG)
    const audio = await createMedia(`audio-acesso-${run()}.mp3`, 'audio/mpeg', TEST_MP3)
    const draft = await payload.create({
      collection: 'jingle',
      data: { title: 'Somente admin', coverImage: cover.id, audio: audio.id },
    })
    createdJingleIds.add(draft.id)

    await expect(
      payload.create({
        collection: 'jingle',
        data: { title: 'Do campaign user', coverImage: cover.id, audio: audio.id },
        user: campaignUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'jingle',
        data: { title: 'Do anônimo', coverImage: cover.id, audio: audio.id },
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'jingle',
        id: draft.id,
        data: { title: 'Editado pelo campaign user' },
        user: campaignUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    await expect(
      payload.delete({
        collection: 'jingle',
        id: draft.id,
        user: campaignUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const editorRead = await payload.find({
      collection: 'jingle',
      where: { id: { equals: draft.id } },
      user: editor,
      overrideAccess: false,
      depth: 0,
    })
    expect(editorRead.totalDocs).toBe(1)

    const editorUpdate = await payload.update({
      collection: 'jingle',
      id: draft.id,
      data: { title: 'Editado pelo editor' },
      user: editor,
      overrideAccess: false,
    })
    expect(editorUpdate.title).toBe('Editado pelo editor')

    const campaignRead = await payload.find({
      collection: 'jingle',
      where: { id: { equals: draft.id } },
      user: campaignUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(campaignRead.totalDocs).toBe(0)
  })

  it('lists published jingles by order, unordered last, title as tiebreak', async () => {
    const marker = run()
    const second = await createJingle({
      title: `Segundo ${marker}`,
      slug: `segundo-${marker}`,
      order: 2,
      published: true,
    })
    const first = await createJingle({
      title: `Primeiro ${marker}`,
      slug: `primeiro-${marker}`,
      order: 1,
      published: true,
    })
    const unorderedB = await createJingle({
      title: `Sem ordem B ${marker}`,
      slug: `sem-ordem-b-${marker}`,
      published: true,
    })
    const unorderedA = await createJingle({
      title: `Sem ordem A ${marker}`,
      slug: `sem-ordem-a-${marker}`,
      published: true,
    })

    const ids = new Set<number | string>([
      first.doc.id,
      second.doc.id,
      unorderedA.doc.id,
      unorderedB.doc.id,
    ])
    const listed = (await getPublishedJingleItems())
      .filter((item) => ids.has(item.id))
      .map((item) => item.id)

    expect(listed).toEqual([first.doc.id, second.doc.id, unorderedA.doc.id, unorderedB.doc.id])
  })

  it('resolves the card media and follows a replaced file', async () => {
    const { doc } = await createJingle({
      title: 'Troca de arquivo',
      slug: 'troca-de-arquivo',
      published: true,
    })
    const original = (await getPublishedJingleItems()).find((item) => item.id === doc.id)
    expect(original?.coverUrl).toMatch(/^\/api\/media\/file\//)
    expect(original?.audioUrl).toMatch(/^\/api\/media\/file\//)

    const replacement = await createMedia(`audio-trocado-${run()}.mp3`, 'audio/mpeg', TEST_MP3)
    await payload.update({ collection: 'jingle', id: doc.id, data: { audio: replacement.id } })

    const updated = (await getPublishedJingleItems()).find((item) => item.id === doc.id)
    expect(updated?.audioUrl).toContain(replacement.filename)
    expect(updated?.audioUrl).not.toBe(original?.audioUrl)
  })

  it('busts the tag on update and delete', async () => {
    const { doc } = await createJingle({ title: 'Ciclo', slug: 'ciclo-s21' })

    revalidateTagMock.mockClear()
    await payload.update({ collection: 'jingle', id: doc.id, data: { published: true } })
    expect(revalidateTagMock).toHaveBeenCalledWith('jingles')

    revalidateTagMock.mockClear()
    await payload.delete({ collection: 'jingle', id: doc.id })
    createdJingleIds.delete(doc.id)
    expect(revalidateTagMock).toHaveBeenCalledWith('jingles')
  })
})
