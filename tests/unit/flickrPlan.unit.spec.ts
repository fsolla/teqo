// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  archivePhotoReportStamp,
  collectArchiveAlbums,
  collectArchiveListing,
  formatArchiveBytes,
  formatArchiveInventory,
  formatArchiveReport,
  parseArchiveCliArgs,
  planArchiveEntries,
  summarizeArchiveInventory,
  summarizeArchivePlan,
  summarizeArchiveResults,
} from '../../scripts/lib/flickrPlan.mjs'

// C231 — the planner contract: pagination with video/malformed accounting,
// the photo→albums map, the plan entries (new/existing/fallback/invalid), the
// summaries and the human receipt lines. Flickr and Payload are always fakes.

const photoPage = (page: number, pages: number, total: number, photo: unknown[]) => ({
  page,
  pages,
  total,
  photo,
})

const fakeClient = ({
  photoPages = {},
  albumPages = {},
  albumPhotoPages = {},
}: {
  photoPages?: Record<number, unknown>
  albumPages?: Record<number, unknown>
  albumPhotoPages?: Record<string, Record<number, unknown>>
} = {}) => ({
  listPhotosPage: vi.fn(async ({ page }: { page: number }) =>
    photoPages[page] ? photoPages[page] : photoPage(page, 1, 0, []),
  ),
  listPhotoSets: vi.fn(async ({ page }: { page: number }) =>
    albumPages[page] ? albumPages[page] : { page, pages: 1, photoset: [] },
  ),
  listPhotoSetPage: vi.fn(async ({ albumId, page }: { albumId: string; page: number }) =>
    albumPhotoPages[albumId]?.[page]
      ? albumPhotoPages[albumId][page]
      : { page, pages: 1, photo: [] },
  ),
})

const completePhoto = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  media: 'photo',
  title: `Foto ${id}`,
  url_o: `https://live.staticflickr.com/1/${id}_o.jpg`,
  path_alias: 'depjorgesolla',
  ...overrides,
})

describe('collectArchiveListing (C231)', () => {
  const photoPages = {
    1: photoPage(1, 2, 4, [
      completePhoto('1'),
      { id: '2', media: 'video' },
      { media: 'photo' },
      completePhoto('3'),
    ]),
    2: photoPage(2, 2, 4, [completePhoto('4')]),
  }

  it('walks every page, accounting videos and malformed items', async () => {
    const client = fakeClient({ photoPages })

    const listing = await collectArchiveListing({ client, userId: 'user' })

    expect(listing.items.map((photo: { id: string }) => photo.id)).toEqual(['1', '3', '4'])
    expect(listing.videos).toEqual(['2'])
    expect(listing.malformed).toHaveLength(1)
    expect(listing).toMatchObject({ apiTotal: 4, pages: 2, pagesFetched: 2 })
  })

  it('stops at the limit and starts at the requested page', async () => {
    const limited = await collectArchiveListing({
      client: fakeClient({ photoPages }),
      userId: 'user',
      limit: 2,
    })
    expect(limited.items.map((photo: { id: string }) => photo.id)).toEqual(['1', '3'])
    expect(limited.pagesFetched).toBe(1)

    const resumed = await collectArchiveListing({
      client: fakeClient({ photoPages }),
      userId: 'user',
      startPage: 2,
    })
    expect(resumed.items.map((photo: { id: string }) => photo.id)).toEqual(['4'])
    expect(resumed.apiTotal).toBe(4)
  })
})

describe('collectArchiveAlbums (C231)', () => {
  it('maps each photo to all its albums and accounts malformed albums', async () => {
    const client = fakeClient({
      albumPages: {
        1: {
          page: 1,
          pages: 2,
          photoset: [
            { id: 'a', title: { _content: 'Saúde' } },
            { id: 'b', title: 'Comícios' },
            { id: 'c', title: '   ' },
          ],
        },
        2: { page: 2, pages: 2, photoset: [{ id: 'b', title: 'Comícios' }] },
      },
      albumPhotoPages: {
        a: { 1: { page: 1, pages: 1, photo: [{ id: '1' }, { id: '2' }] } },
        b: { 1: { page: 1, pages: 1, photo: [{ id: '2' }] } },
      },
    })

    const { albumsById, albumsByPhotoId, skippedAlbums } = await collectArchiveAlbums({
      client,
      userId: 'user',
    })

    expect(albumsById.size).toBe(2)
    expect(albumsById.get('a')).toEqual({ albumId: 'a', title: 'Saúde' })
    expect(albumsByPhotoId.get('1')).toEqual([{ albumId: 'a', title: 'Saúde' }])
    expect(albumsByPhotoId.get('2')).toEqual([
      { albumId: 'a', title: 'Saúde' },
      { albumId: 'b', title: 'Comícios' },
    ])
    expect(skippedAlbums).toEqual([{ albumId: 'c', reason: 'title' }])
  })
})

describe('planArchiveEntries (C231)', () => {
  it('classifies existing, new, fallback and invalid entries', async () => {
    const albumsByPhotoId = new Map([['1', [{ albumId: 'a', title: 'Saúde' }]]])
    const findExisting = vi.fn(async (flickrId: string) =>
      flickrId === '3' ? { id: 99, filename: 'flickr-3.jpg', filesize: 10 } : null,
    )

    const entries = await planArchiveEntries({
      items: [
        completePhoto('1'),
        completePhoto('2', { url_o: undefined }),
        completePhoto('3'),
        completePhoto('4', { media: 'screenshots' }),
      ],
      albumsByPhotoId,
      findExisting,
    })

    expect(entries.map((entry) => entry.status)).toEqual(['new', 'fallback', 'existing', 'invalid'])
    expect(entries[0].record).toMatchObject({
      flickrId: '1',
      albums: [{ albumId: 'a', title: 'Saúde' }],
      originalKind: 'original',
    })
    expect(entries[2]).toMatchObject({ existing: { id: 99 } })
    expect(entries[3]).toMatchObject({ reason: 'not-a-photo' })
    expect(findExisting).toHaveBeenCalledTimes(4)
  })

  it('classifies an already-archived photo as existing even without url_o', async () => {
    const findExisting = vi.fn(async () => ({ id: 7, filename: 'flickr-7.jpg', filesize: 1 }))

    const entries = await planArchiveEntries({
      items: [completePhoto('7', { url_o: undefined })],
      albumsByPhotoId: new Map(),
      findExisting,
    })

    expect(entries).toEqual([expect.objectContaining({ flickrId: '7', status: 'existing' })])
    expect(entries[0].record).toBeUndefined()
  })
})

describe('summaries (C231)', () => {
  it('summarizes the plan entries', () => {
    expect(
      summarizeArchivePlan([
        { status: 'new' },
        { status: 'new' },
        { status: 'existing' },
        { status: 'fallback' },
        { status: 'invalid' },
      ]),
    ).toEqual({ new: 2, existing: 1, fallback: 1, invalid: 1 })
  })

  it('summarizes the apply results with downloaded bytes and failures', () => {
    expect(
      summarizeArchiveResults([
        { flickrId: '1', status: 'created', bytes: 100 },
        { flickrId: '2', status: 'existing' },
        { flickrId: '3', status: 'failed', stage: 'download', error: 'HTTP 404' },
        { flickrId: '4', status: 'created', bytes: 50 },
      ]),
    ).toEqual({
      created: 2,
      existing: 1,
      failed: 1,
      bytes: 150,
      failures: [{ flickrId: '3', stage: 'download', error: 'HTTP 404' }],
    })
  })

  it('summarizes the stored inventory per album and per metadata gap', () => {
    const inventory = summarizeArchiveInventory([
      {
        flickrId: '1',
        filename: 'flickr-1.jpg',
        filesize: 100,
        takenAt: '2025-03-14 10:20:30',
        geo: { latitude: -12, longitude: -38 },
        exif: [{ tag: 'Make' }],
        tags: [{ name: 'saude' }],
        albums: [
          { albumId: 'a', title: 'Saúde' },
          { albumId: 'b', title: 'Comícios' },
        ],
      },
      {
        flickrId: '2',
        filename: null,
        filesize: 50,
        takenAt: null,
        geo: { latitude: null, longitude: null },
        exif: [],
        tags: [],
        albums: [{ albumId: 'a', title: 'Saúde' }],
      },
    ])

    expect(inventory).toMatchObject({
      total: 2,
      bytes: 150,
      withTakenAt: 1,
      withGeo: 1,
      withExif: 1,
      withTags: 1,
      withAlbums: 2,
      missingFilename: ['2'],
    })
    expect(inventory.albums).toEqual([
      { albumId: 'a', title: 'Saúde', count: 2 },
      { albumId: 'b', title: 'Comícios', count: 1 },
    ])
  })
})

describe('receipt formatting (C231)', () => {
  it('formats the plan and the apply reports without hiding failures', () => {
    const base = {
      apiTotal: 4,
      collected: 3,
      videos: 1,
      malformed: [],
      albums: 2,
      durationMs: 1500,
    }

    const planLines = formatArchiveReport({
      ...base,
      mode: 'plan',
      plan: { new: 2, existing: 1, fallback: 0, invalid: 0 },
      invalidEntries: [{ flickrId: '9', reason: 'id' }],
    })
    expect(planLines.join('\n')).toContain('plano (dry-run): novas: 2')
    expect(planLines.join('\n')).toContain('inválida 9: id')
    expect(planLines.join('\n')).toContain('tempo: 1.5s')

    const applyLines = formatArchiveReport({
      ...base,
      mode: 'apply',
      summary: {
        created: 1,
        existing: 1,
        failed: 1,
        bytes: 2 * 1024 * 1024,
        failures: [{ flickrId: '3', stage: 'download', error: 'HTTP 404' }],
      },
    })
    const applyText = applyLines.join('\n')
    expect(applyText).toContain('resultado: novas: 1')
    expect(applyText).toContain('bytes baixados: 2.0 MiB')
    expect(applyText).toContain('- 3 (download): HTTP 404')
  })

  it('formats the inventory and the byte label', () => {
    const lines = formatArchiveInventory({
      total: 2,
      bytes: 1024 * 1024,
      withTakenAt: 1,
      withGeo: 1,
      withExif: 0,
      withTags: 2,
      withAlbums: 1,
      albums: [{ albumId: 'a', title: 'Saúde', count: 1 }],
      missingFilename: ['2'],
    })
    const text = lines.join('\n')
    expect(text).toContain('inventário: 2 foto(s) · 1.0 MiB')
    expect(text).toContain('- Saúde (a): 1')
    expect(text).toContain('sem arquivo armazenado: 2')
    expect(formatArchiveBytes(2 * 1024 * 1024)).toBe('2.0 MiB')
  })

  it('stamps the report file name', () => {
    expect(archivePhotoReportStamp('2026-09-26T06:20:39.123Z')).toBe('2026-09-26T06-20-39-123Z')
  })
})

describe('parseArchiveCliArgs (C231)', () => {
  it('defaults to the plan mode, page 1 and the standard receipt dir', () => {
    expect(parseArchiveCliArgs([])).toEqual({
      apply: false,
      verify: false,
      limit: null,
      page: 1,
      out: 'data/flickr',
      help: false,
    })
  })

  it('parses the flags, the canary and the receipt dir', () => {
    expect(
      parseArchiveCliArgs(['--apply', '--limit', '5', '--page', '3', '--out', 'data/fotos']),
    ).toMatchObject({ apply: true, verify: false, limit: 5, page: 3, out: 'data/fotos' })
    expect(parseArchiveCliArgs(['--verify'])).toMatchObject({ verify: true, apply: false })
    expect(parseArchiveCliArgs(['--help'])).toMatchObject({ help: true })
  })

  it('refuses exclusive modes, invalid numbers, escaping --out and unknown flags', () => {
    expect(() => parseArchiveCliArgs(['--apply', '--verify'])).toThrow(/mutuamente exclusivos/)
    expect(() => parseArchiveCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseArchiveCliArgs(['--limit', 'abc'])).toThrow(/--limit/)
    expect(() => parseArchiveCliArgs(['--page', '0'])).toThrow(/--page/)
    expect(() => parseArchiveCliArgs(['--out', 'data/../fora'])).toThrow(/escapar/)
    expect(parseArchiveCliArgs(['--out', 'data/..final'])).toMatchObject({ out: 'data/..final' })
    expect(() => parseArchiveCliArgs(['--force'])).toThrow(/argumento desconhecido/)
    expect(() => parseArchiveCliArgs(['--limit'])).toThrow(/faltou valor/)
    for (const argv of [['--apply', '--verify'], ['--force'], ['--limit']]) {
      expect(() => parseArchiveCliArgs(argv)).toThrow(/pnpm flickr:import/)
    }
  })
})
