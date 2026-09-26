import { describe, expect, it } from 'vitest'

import {
  archivePhotoAlt,
  archivePhotoExifEntries,
  archivePhotoGeoFrom,
  archivePhotoImportFromFlickr,
  archivePhotoPostedAt,
  archivePhotoSourceUrl,
  archivePhotoStorageFilename,
  archivePhotoTags,
  archivePhotoTakenAt,
} from '@/lib/archivePhoto'

// C231 — the pure rules of the Flickr archive mapping: the original naming,
// the metadata normalization (tags/geo/EXIF/dates) and the three named
// rejection reasons. Real API payloads never enter the suite.

const listingPhoto = (overrides: Record<string, unknown> = {}) => ({
  id: '53123456789',
  owner: '12345678@N00',
  title: 'Comício em Feira de Santana',
  description: { _content: 'Registro do comício.' },
  datetaken: '2025-03-14 10:20:30',
  dateupload: '1742032800',
  license: '0',
  tags: 'saude salvador saude',
  latitude: '-12.2664',
  longitude: '-38.9663',
  media: 'photo',
  url_o: 'https://live.staticflickr.com/65535/53123456789_abcdef_o.jpg',
  path_alias: 'depjorgesolla',
  ...overrides,
})

describe('archivePhotoStorageFilename (C231)', () => {
  it('derives the deterministic name from the original URL', () => {
    expect(
      archivePhotoStorageFilename('53123456789', 'https://live.staticflickr.com/1/2_o.JPG'),
    ).toBe('flickr-53123456789.jpg')
    expect(
      archivePhotoStorageFilename('53123456789', 'https://live.staticflickr.com/1/2_o.jpeg'),
    ).toBe('flickr-53123456789.jpg')
    expect(
      archivePhotoStorageFilename('53123456789', 'https://live.staticflickr.com/1/2_o.png'),
    ).toBe('flickr-53123456789.png')
  })

  it('falls back to .jpg for an extensionless or malformed URL', () => {
    expect(archivePhotoStorageFilename('42', 'https://live.staticflickr.com/1/2_o')).toBe(
      'flickr-42.jpg',
    )
    expect(archivePhotoStorageFilename('42', 'not a url')).toBe('flickr-42.jpg')
  })

  it('keeps only filename-safe id characters', () => {
    expect(archivePhotoStorageFilename('53/../evil', 'https://x/1_o.jpg')).toBe('flickr-53evil.jpg')
  })
})

describe('archivePhotoAlt (C231)', () => {
  it('prefers the Flickr title and falls back to the id', () => {
    expect(archivePhotoAlt({ title: '  Comício  ', flickrId: '1' })).toBe('Comício')
    expect(archivePhotoAlt({ title: '   ', flickrId: '1' })).toBe('Foto do acervo (Flickr 1)')
    expect(archivePhotoAlt({ title: null, flickrId: '1' })).toBe('Foto do acervo (Flickr 1)')
  })
})

describe('archivePhotoSourceUrl (C231)', () => {
  it('uses the path alias when present and the id-only page when absent', () => {
    expect(archivePhotoSourceUrl({ flickrId: '42', pathAlias: 'depjorgesolla' })).toBe(
      'https://www.flickr.com/photos/depjorgesolla/42/',
    )
    expect(archivePhotoSourceUrl({ flickrId: '42', pathAlias: null })).toBe(
      'https://www.flickr.com/photo.gne?id=42',
    )
  })
})

describe('archivePhotoTakenAt / archivePhotoPostedAt (C231)', () => {
  it('keeps the zoneless wall clock, completing a date-only value', () => {
    expect(archivePhotoTakenAt('2025-03-14 10:20:30')).toBe('2025-03-14 10:20:30')
    expect(archivePhotoTakenAt('2025-03-14')).toBe('2025-03-14 00:00:00')
    expect(archivePhotoTakenAt('14/03/2025')).toBeNull()
    expect(archivePhotoTakenAt(undefined)).toBeNull()
  })

  it('derives the ISO UTC upload time from epoch seconds', () => {
    expect(archivePhotoPostedAt('1742032800')).toBe(new Date(1742032800_000).toISOString())
    expect(archivePhotoPostedAt(1742032800)).toBe(new Date(1742032800_000).toISOString())
    expect(archivePhotoPostedAt('0')).toBeNull()
    expect(archivePhotoPostedAt('ontem')).toBeNull()
  })
})

describe('archivePhotoTags (C231)', () => {
  it('splits the space-separated listing value and collapses duplicates', () => {
    expect(archivePhotoTags('saude  salvador saude bahia')).toEqual(['saude', 'salvador', 'bahia'])
    expect(archivePhotoTags(['saude bahia', 'saude'])).toEqual(['saude', 'bahia'])
    expect(archivePhotoTags('')).toEqual([])
    expect(archivePhotoTags(null)).toEqual([])
  })
})

describe('archivePhotoGeoFrom (C231)', () => {
  it('accepts a real point and refuses the (0, 0) sentinel or out-of-range values', () => {
    expect(archivePhotoGeoFrom('-12.2664', '-38.9663')).toEqual({
      latitude: -12.2664,
      longitude: -38.9663,
    })
    expect(archivePhotoGeoFrom(0, 0)).toBeNull()
    expect(archivePhotoGeoFrom('91', '0.5')).toBeNull()
    expect(archivePhotoGeoFrom('-12.5', '181')).toBeNull()
    expect(archivePhotoGeoFrom('', undefined)).toBeNull()
  })

  it('never returns half a point when one axis is missing', () => {
    expect(archivePhotoGeoFrom('-12.2664', undefined)).toBeNull()
    expect(archivePhotoGeoFrom(undefined, '-38.9663')).toBeNull()
    expect(archivePhotoGeoFrom('-12.2664', '')).toBeNull()
    expect(archivePhotoGeoFrom('', '-38.9663')).toBeNull()
    expect(archivePhotoGeoFrom(null, null)).toBeNull()
  })
})

describe('archivePhotoExifEntries (C231)', () => {
  it('normalizes the API answer, preferring clean values and sorting by tag', () => {
    expect(
      archivePhotoExifEntries([
        { tag: 'Model', label: 'Modelo', raw: 'Canon EOS', clean: 'Canon EOS R6' },
        { tag: 'Make', label: 'Fabricante', raw: 'Canon' },
        { tag: 'Empty', raw: '   ' },
        { tag: 'NoValue' },
        'lixo',
      ]),
    ).toEqual([
      { tag: 'Make', label: 'Fabricante', value: 'Canon' },
      { tag: 'Model', label: 'Modelo', value: 'Canon EOS R6' },
    ])
    expect(archivePhotoExifEntries(null)).toEqual([])
  })
})

describe('archivePhotoImportFromFlickr (C231)', () => {
  it('maps a complete listing item into the archive record', () => {
    const result = archivePhotoImportFromFlickr({
      photo: listingPhoto(),
      albums: [{ albumId: '721777', title: 'Saúde' }],
      exif: [{ tag: 'Make', label: 'Fabricante', raw: 'Canon' }],
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record).toEqual({
      flickrId: '53123456789',
      sourceUrl: 'https://www.flickr.com/photos/depjorgesolla/53123456789/',
      owner: '12345678@N00',
      license: '0',
      title: 'Comício em Feira de Santana',
      description: 'Registro do comício.',
      tags: ['saude', 'salvador'],
      takenAt: '2025-03-14 10:20:30',
      postedAt: new Date(1742032800_000).toISOString(),
      albums: [{ albumId: '721777', title: 'Saúde' }],
      geo: { latitude: -12.2664, longitude: -38.9663 },
      exif: [{ tag: 'Make', label: 'Fabricante', value: 'Canon' }],
      originalUrl: 'https://live.staticflickr.com/65535/53123456789_abcdef_o.jpg',
      originalKind: 'original',
    })
  })

  it('falls back to the largest size and collapses albums deterministically', () => {
    const result = archivePhotoImportFromFlickr({
      photo: listingPhoto({ url_o: undefined }),
      albums: [
        { albumId: 'b', title: 'Comícios' },
        { albumId: 'a', title: 'Saúde' },
        { albumId: 'b', title: 'Duplicado' },
      ],
      exif: null,
      fallbackOriginalUrl: 'https://live.staticflickr.com/1/2_b.jpg',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.originalKind).toBe('largest')
    expect(result.record.originalUrl).toBe('https://live.staticflickr.com/1/2_b.jpg')
    expect(result.record.albums).toEqual([
      { albumId: 'b', title: 'Comícios' },
      { albumId: 'a', title: 'Saúde' },
    ])
  })

  it('rejects each failure with its own named reason', () => {
    expect(
      archivePhotoImportFromFlickr({ photo: listingPhoto({ id: 'abc' }), albums: [], exif: null }),
    ).toEqual({ ok: false, reason: 'id' })
    expect(
      archivePhotoImportFromFlickr({
        photo: listingPhoto({ media: 'video' }),
        albums: [],
        exif: null,
      }),
    ).toEqual({ ok: false, reason: 'not-a-photo' })
    expect(
      archivePhotoImportFromFlickr({
        photo: listingPhoto({ url_o: undefined }),
        albums: [],
        exif: null,
      }),
    ).toEqual({ ok: false, reason: 'original' })
  })

  it('tolerates absent optional metadata and a numeric license', () => {
    const result = archivePhotoImportFromFlickr({
      photo: listingPhoto({
        title: '',
        description: undefined,
        tags: undefined,
        datetaken: 'sem data',
        dateupload: undefined,
        latitude: '0',
        longitude: '0',
        license: 4,
        path_alias: undefined,
      }),
      albums: [],
      exif: undefined,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record).toMatchObject({
      title: null,
      description: null,
      tags: [],
      takenAt: null,
      postedAt: null,
      geo: null,
      exif: [],
      license: '4',
      sourceUrl: 'https://www.flickr.com/photo.gne?id=53123456789',
    })
  })

  it('rejects a non-scalar license instead of stringifying it', () => {
    const result = archivePhotoImportFromFlickr({
      photo: listingPhoto({ license: { id: 4 } }),
      albums: [],
      exif: null,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.record.license).toBeNull()
  })
})
