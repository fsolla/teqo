// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ARCHIVE_PHOTO_SLUG, type ArchivePhotoImport } from '@/lib/archivePhoto'
import type { ArchivePhotoSuggestion } from '@/lib/archivePhotoCatalog'
import { publicFigureCatalog } from '@/lib/publicFigureCatalog'
import config from '@/payload.config'
import {
  catalogArchivePhoto,
  listArchivePhotoCatalogQueue,
  type ArchivePhotoAnalyzer,
  type ArchivePhotoCatalogItem,
} from '@/utilities/flickr/archivePhotoCatalog'
import { ingestArchivePhoto } from '@/utilities/flickr/archivePhotoIngest'

import { ARCHIVE_PHOTO_JPEG_BYTES } from '../helpers/archivePhotoFixture'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

// C232 — the cataloguing boundary over the real Payload `teqo_test`: the
// transactional write, the curated-wins rule, the honest failure (nothing
// written, retried) and the derived index (searchText/takenOn). The vision
// engine is a stub — the real provider never enters the suite.

let payload: Payload
const createdFlickrIds = new Set<string>()
const tempDirs: string[] = []

const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

const figureName = publicFigureCatalog[0]!.name

const record = (
  flickrId: string,
  overrides: Partial<ArchivePhotoImport> = {},
): ArchivePhotoImport => {
  createdFlickrIds.add(flickrId)
  return {
    flickrId,
    sourceUrl: `https://www.flickr.com/photos/depjorgesolla/${flickrId}/`,
    owner: '12345678@N00',
    license: '0',
    title: `Foto ${flickrId}`,
    description: null,
    tags: [],
    takenAt: '2025-03-14 10:20:30',
    postedAt: '2025-03-15T10:00:00.000Z',
    albums: [],
    geo: null,
    exif: [],
    originalUrl: `https://live.staticflickr.com/65535/${flickrId}_abcdef_o.jpg`,
    originalKind: 'original',
    ...overrides,
  }
}

const createPhoto = async (
  flickrId: string,
  overrides: Partial<ArchivePhotoImport> = {},
): Promise<{ id: number; item: ArchivePhotoCatalogItem }> => {
  const dir = await mkdtemp(join(tmpdir(), 'archive-photo-'))
  tempDirs.push(dir)
  const filePath = join(dir, `flickr-${flickrId}.jpg`)
  await writeFile(filePath, ARCHIVE_PHOTO_JPEG_BYTES)
  const created = await ingestArchivePhoto(payload, record(flickrId, overrides), { filePath })
  if (created.status !== 'created') throw new Error(`fixture not created: ${created.status}`)

  const queue = await listArchivePhotoCatalogQueue({ payload })
  const item = queue.find((entry) => entry.flickrId === flickrId)
  if (!item) throw new Error(`fixture not in the catalog queue: ${flickrId}`)
  return { id: created.id, item }
}

const suggestion = (overrides: Partial<ArchivePhotoSuggestion> = {}): ArchivePhotoSuggestion => ({
  caption: null,
  description: null,
  scene: null,
  visibleText: null,
  hasPeople: null,
  themes: [],
  ...overrides,
})

const analyzeWith =
  (answer: ArchivePhotoSuggestion): ArchivePhotoAnalyzer =>
  async () =>
    answer

const findByFlickrId = async (flickrId: string) => {
  const found = await payload.find({
    collection: ARCHIVE_PHOTO_SLUG,
    where: { flickrId: { equals: flickrId } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return found.docs[0] ?? null
}

const municipalityId = async (slug: string): Promise<number> => {
  const found = await payload.find({
    collection: 'municipality',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const id = found.docs[0]?.id
  if (id == null) throw new Error(`município fixture ausente: ${slug}`)
  return id
}

describe('catalogArchivePhoto (C232)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const flickrId of createdFlickrIds) {
      await payload.delete({
        collection: ARCHIVE_PHOTO_SLUG,
        where: { flickrId: { equals: flickrId } },
        overrideAccess: true,
      })
    }
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('catalogues one photo and derives the searchable index', async () => {
    const feira = await municipalityId('feira-de-santana')
    const { item } = await createPhoto('53900000001', {
      title: 'Plenária em Feira de Santana',
      albums: [{ albumId: '1', title: 'Plenária em Feira de Santana' }],
      tags: ['saude'],
    })

    const result = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(
        suggestion({
          caption: 'Plenária lotada no interior',
          description: 'Solla discursa para uma plateia cheia.',
          scene: 'plenaria',
          visibleText: 'SAÚDE É DIREITO',
          hasPeople: true,
          themes: ['saude'],
        }),
      ),
    })

    expect(result).toEqual({ status: 'cataloged', source: 'ai' })
    const doc = await findByFlickrId('53900000001')
    expect(doc?.catalog).toMatchObject({
      caption: 'Plenária lotada no interior',
      description: 'Solla discursa para uma plateia cheia.',
      scene: 'plenaria',
      visibleText: 'SAÚDE É DIREITO',
      hasPeople: true,
      themes: ['saude'],
      municipality: feira,
      source: 'ai',
    })
    expect(doc?.catalog?.catalogedAt).toBeTruthy()
    expect(doc?.takenOn).toBe('2025-03-14T12:00:00.000Z')
    expect(doc?.searchText).toContain('plenaria')
    expect(doc?.searchText).toContain('feira de santana')
    expect(doc?.searchText).toContain('saude')
    expect(doc?.searchText).toContain('plenaria lotada no interior')
  })

  it('matches the curated public-figure catalog against the text, never the model', async () => {
    const { item } = await createPhoto('53900000002', {
      title: `Encontro com ${figureName}`,
    })

    expect(item.title).toContain(figureName)
    const result = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion({ caption: 'Encontro político' })),
    })

    expect(result).toEqual({ status: 'cataloged', source: 'ai' })
    const doc = await findByFlickrId('53900000002')
    expect(doc?.catalog?.people).toEqual([figureName])
  })

  it('states metadata when the model has nothing to propose', async () => {
    const feira = await municipalityId('feira-de-santana')
    const { item } = await createPhoto('53900000003', {
      title: 'Visita a Feira de Santana',
    })

    const result = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion()),
    })

    expect(result).toEqual({ status: 'cataloged', source: 'metadata' })
    const doc = await findByFlickrId('53900000003')
    expect(doc?.catalog?.municipality).toBe(feira)
    expect(doc?.catalog?.source).toBe('metadata')
    expect(doc?.catalog?.catalogedAt).toBeTruthy()
  })

  it('states none, honestly, when there is nothing at all', async () => {
    const { item } = await createPhoto('53900000004')

    const result = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion()),
    })

    expect(result).toEqual({ status: 'cataloged', source: 'none' })
    const doc = await findByFlickrId('53900000004')
    expect(doc?.catalog?.source).toBe('none')
    expect(doc?.catalog?.catalogedAt).toBeTruthy()
  })

  it('never overwrites a curated field', async () => {
    const feira = await municipalityId('feira-de-santana')
    const { id, item } = await createPhoto('53900000005', {
      title: 'Plenária em Feira de Santana',
    })
    const admin = await campaignFixtures().createAdminUser()
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { catalog: { caption: 'Legenda humana', municipality: feira } },
      user: admin,
      overrideAccess: false,
    })

    const result = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion({ caption: 'Legenda da IA' })),
    })

    expect(result).toEqual({ status: 'cataloged', source: 'none' })
    const doc = await findByFlickrId('53900000005')
    expect(doc?.catalog?.caption).toBe('Legenda humana')
    expect(doc?.catalog?.municipality).toBe(feira)
    expect(doc?.curatedFields).toEqual(expect.arrayContaining(['caption', 'municipality']))
  })

  it('reports a failed analysis, writes nothing and lets the next run retry', async () => {
    const { item } = await createPhoto('53900000006', { title: 'Plenária em Feira de Santana' })

    const failing: ArchivePhotoAnalyzer = async () => {
      throw new Error('engine fora do ar')
    }
    const failed = await catalogArchivePhoto({ payload, item, analyze: failing })

    expect(failed).toEqual({ status: 'failed', stage: 'analyze', error: 'engine fora do ar' })
    expect((await findByFlickrId('53900000006'))?.catalog?.catalogedAt ?? null).toBeNull()

    const retried = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion({ caption: 'Segunda tentativa' })),
    })
    expect(retried).toEqual({ status: 'cataloged', source: 'ai' })
    expect((await findByFlickrId('53900000006'))?.catalog?.caption).toBe('Segunda tentativa')
  })

  it('skips a photo catalogued after the queue was read', async () => {
    const { item } = await createPhoto('53900000007')
    await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion({ caption: 'Primeira passada' })),
    })

    const second = await catalogArchivePhoto({
      payload,
      item,
      analyze: analyzeWith(suggestion({ caption: 'Segunda passada' })),
    })

    expect(second).toEqual({ status: 'skipped' })
    expect((await findByFlickrId('53900000007'))?.catalog?.caption).toBe('Primeira passada')
    expect(
      (await listArchivePhotoCatalogQueue({ payload })).map((entry) => entry.flickrId),
    ).not.toContain('53900000007')
  })

  it('caps the queue with the canary limit and marks curation only on user edits', async () => {
    const { id } = await createPhoto('53900000008')
    await createPhoto('53900000009')
    const queued = await listArchivePhotoCatalogQueue({ payload, limit: 1 })
    expect(queued).toHaveLength(1)

    const admin = await campaignFixtures().createAdminUser()
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { catalog: { scene: 'evento' } },
      user: admin,
      overrideAccess: false,
    })
    expect((await findByFlickrId('53900000008'))?.curatedFields).toEqual(['scene'])

    // A no-op admin save marks nothing new.
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { catalog: { scene: 'evento' } },
      user: admin,
      overrideAccess: false,
    })
    expect((await findByFlickrId('53900000008'))?.curatedFields).toEqual(['scene'])

    // The system write (the cataloguing itself) never marks.
    await payload.update({
      collection: ARCHIVE_PHOTO_SLUG,
      id,
      data: { catalog: { caption: 'escrita do sistema' } },
      context: { archivePhotoCatalog: true },
      overrideAccess: true,
    })
    expect((await findByFlickrId('53900000008'))?.curatedFields).toEqual(['scene'])
  })
})
