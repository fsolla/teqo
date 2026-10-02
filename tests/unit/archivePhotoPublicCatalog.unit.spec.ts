// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { ARCHIVE_PHOTO_SCENES } from '@/lib/archivePhotoCatalog'
import {
  ARCHIVE_PHOTO_ALBUM_PAGE_SIZE,
  ARCHIVE_PHOTO_ALBUM_PATH,
  archivePhotoAlbumActiveFilters,
  archivePhotoAlbumFacets,
  archivePhotoAlbumHeading,
  archivePhotoLongDateLabel,
  archivePhotoShortDateLabel,
  buildArchivePhotoAlbumHref,
  filterArchivePhotoAlbumItems,
  paginateArchivePhotoAlbumItems,
  parseArchivePhotoAlbumParams,
  toArchivePhotoPublicItem,
  type ArchivePhotoPublicItem,
  type ArchivePhotoPublicSource,
} from '@/lib/archivePhotoPublicCatalog'

// C233 — the pure contract of the public album: the single-value URL parse
// (fail-closed), the canonical href, the facet derivation over approved items
// only, the AND filtering with the term and the contextual heading.

const source = (
  id: number,
  overrides: Partial<ArchivePhotoPublicSource> = {},
): ArchivePhotoPublicSource => ({
  id,
  alt: `Descrição da foto ${id}`,
  takenOn: '2026-09-12T12:00:00.000Z',
  municipalityName: 'Feira de Santana',
  municipalitySlug: 'feira-de-santana',
  filename: `flickr-${id}.jpg`,
  publicationStatus: 'approved',
  searchText: 'plenaria saude feira de santana',
  catalog: {
    caption: `Legenda ${id}`,
    scene: 'plenaria',
    people: ['Jorge Solla'],
  },
  figures: [{ slug: 'jorge-solla', name: 'Jorge Solla' }],
  ...overrides,
})

const item = (id: number, overrides: Partial<ArchivePhotoPublicSource> = {}) =>
  toArchivePhotoPublicItem(source(id, overrides))!

describe('parseArchivePhotoAlbumParams', () => {
  it('keeps one valid value per facet and drops hand-typed garbage', () => {
    expect(
      parseArchivePhotoAlbumParams({
        data: '2026-09-12',
        municipio: 'feira-de-santana',
        atividade: 'plenaria',
        pessoa: 'jorge-solla',
        q: '  saúde  ',
        pagina: '3',
        foto: '42',
      }),
    ).toEqual({
      data: '2026-09-12',
      municipio: 'feira-de-santana',
      atividade: 'plenaria',
      pessoa: 'jorge-solla',
      q: 'saúde',
      pagina: 3,
      foto: 42,
    })
  })

  it('fails each param closed on its own', () => {
    const parsed = parseArchivePhotoAlbumParams({
      data: '2026-02-30',
      municipio: '../etc/passwd',
      atividade: 'comicio-inventado',
      pessoa: 'Jorge Solla',
      pagina: '0',
      foto: 'abc',
    })

    expect(parsed.data).toBeNull()
    expect(parsed.municipio).toBeNull()
    expect(parsed.atividade).toBeNull()
    expect(parsed.pessoa).toBeNull()
    expect(parsed.pagina).toBe(1)
    expect(parsed.foto).toBeNull()
  })

  it('accepts every declared scene value and its pt-BR label', () => {
    for (const scene of ARCHIVE_PHOTO_SCENES) {
      expect(parseArchivePhotoAlbumParams({ atividade: scene.value }).atividade).toBe(scene.value)
      expect(parseArchivePhotoAlbumParams({ atividade: scene.label }).atividade).toBe(scene.value)
    }
  })
})

describe('buildArchivePhotoAlbumHref', () => {
  it('serializes the facets in canonical order, drops pagina=1 and clean params', () => {
    expect(
      buildArchivePhotoAlbumHref({
        data: '2026-09-12',
        municipio: 'feira-de-santana',
        atividade: 'plenaria',
        pessoa: 'jorge-solla',
        q: 'saúde',
        pagina: 1,
      }),
    ).toBe(
      '/fotos?data=2026-09-12&municipio=feira-de-santana&atividade=plenaria&pessoa=jorge-solla&q=sa%C3%BAde',
    )

    expect(buildArchivePhotoAlbumHref({})).toBe(ARCHIVE_PHOTO_ALBUM_PATH)
  })

  it('includes foto only when asked (the overlay link) and keeps it out of the canonical form', () => {
    expect(buildArchivePhotoAlbumHref({ municipio: 'feira-de-santana', foto: 7 })).toBe(
      '/fotos?municipio=feira-de-santana&foto=7',
    )
    expect(buildArchivePhotoAlbumHref({ municipio: 'feira-de-santana', foto: null })).toBe(
      '/fotos?municipio=feira-de-santana',
    )
  })
})

describe('date labels', () => {
  it('derives the long and short pt-BR labels from the stored noon-UTC day', () => {
    expect(archivePhotoLongDateLabel('2026-09-12T12:00:00.000Z')).toBe('12 de setembro de 2026')
    expect(archivePhotoShortDateLabel('2026-09-12T12:00:00.000Z')).toBe('12 set 2026')
    expect(archivePhotoLongDateLabel(null)).toBeNull()
    expect(archivePhotoShortDateLabel('sem data')).toBeNull()
  })
})

describe('toArchivePhotoPublicItem', () => {
  it('fails closed for any status that is not approved', () => {
    expect(toArchivePhotoPublicItem(source(1, { publicationStatus: 'draft' }))).toBeNull()
    expect(toArchivePhotoPublicItem(source(1, { publicationStatus: 'removed' }))).toBeNull()
    expect(toArchivePhotoPublicItem(source(1, { publicationStatus: null }))).toBeNull()
    expect(toArchivePhotoPublicItem(source(1, { publicationStatus: undefined }))).toBeNull()
  })

  it('builds the card/dialog view: title, meta line and people label', () => {
    const photo = item(1, {
      catalog: { caption: null, scene: 'reuniao', people: [] },
      figures: [
        { slug: 'jorge-solla', name: 'Jorge Solla' },
        { slug: 'rui-costa', name: 'Rui Costa' },
      ],
    })

    expect(photo.title).toBe('Descrição da foto 1')
    expect(photo.metaLabel).toBe('12 set 2026 · Feira de Santana · Reunião')
    expect(photo.peopleLabel).toBe('Jorge Solla e Rui Costa')
    expect(photo.dateLabel).toBe('12 de setembro de 2026')
  })

  it('derives the paths and a legible download name, never the stored key', () => {
    const photo = item(9)

    expect(photo.thumbnailPath).toBe('/fotos/9/midia?tamanho=grade')
    expect(photo.mediaPath).toBe('/fotos/9/midia')
    expect(photo.downloadPath).toBe('/fotos/9/midia?download=1')
    expect(photo.downloadFilename).toBe('jorge-solla-1313-foto-9.jpg')
  })

  it('derives people only from the curated figures (never the text catalog) and dedupes by slug', () => {
    const textOnly = item(1, {
      catalog: { caption: null, scene: 'plenaria', people: ['Rui Costa'] },
      figures: [],
    })
    const duplicated = item(2, {
      figures: [
        { slug: 'rui-costa', name: 'Rui Costa' },
        { slug: 'rui-costa', name: 'rui costa' },
        { slug: '', name: 'Sem slug' },
      ],
    })

    expect(textOnly.people).toEqual([])
    expect(duplicated.people).toEqual([{ slug: 'rui-costa', name: 'Rui Costa' }])
  })
})

describe('archivePhotoAlbumFacets / filter / heading', () => {
  const items = [
    item(1),
    item(2, {
      takenOn: '2026-09-08T12:00:00.000Z',
      municipalityName: 'Salvador',
      municipalitySlug: 'salvador',
      searchText: 'visita posto salvador rui costa',
      catalog: { caption: 'Visita', scene: 'visita', people: ['Rui Costa'] },
      figures: [{ slug: 'rui-costa', name: 'Rui Costa' }],
    }),
    item(3, {
      takenOn: null,
      municipalityName: null,
      municipalitySlug: null,
      searchText: 'retrato gabinete',
      catalog: { caption: 'Retrato', scene: 'retrato', people: [] },
      figures: [],
    }),
  ]

  it('derives facets from the approved items only, in their own orders', () => {
    const facets = archivePhotoAlbumFacets(items)

    expect(facets.data.map((option) => option.value)).toEqual(['2026-09-12', '2026-09-08'])
    expect(facets.municipio).toEqual([
      { value: 'feira-de-santana', label: 'Feira de Santana' },
      { value: 'salvador', label: 'Salvador' },
    ])
    expect(facets.atividade.map((option) => option.value)).toEqual([
      'plenaria',
      'visita',
      'retrato',
    ])
    expect(facets.pessoa).toEqual([
      { value: 'jorge-solla', label: 'Jorge Solla' },
      { value: 'rui-costa', label: 'Rui Costa' },
    ])
  })

  it('combines every facet as AND and matches the term over the haystack', () => {
    const params = parseArchivePhotoAlbumParams({})
    expect(filterArchivePhotoAlbumItems(items, params)).toHaveLength(3)

    expect(
      filterArchivePhotoAlbumItems(items, { ...params, municipio: 'salvador' }).map((i) => i.id),
    ).toEqual([2])
    expect(
      filterArchivePhotoAlbumItems(items, { ...params, atividade: 'plenaria' }).map((i) => i.id),
    ).toEqual([1])
    expect(
      filterArchivePhotoAlbumItems(items, { ...params, pessoa: 'rui-costa' }).map((i) => i.id),
    ).toEqual([2])
    expect(
      filterArchivePhotoAlbumItems(items, { ...params, data: '2026-09-08' }).map((i) => i.id),
    ).toEqual([2])
    // A day filter never matches a photo without `takenOn`.
    expect(filterArchivePhotoAlbumItems(items, { ...params, data: '2026-01-01' })).toHaveLength(0)
    // The term uses the normalized haystack (accent/case insensitive) and does
    // not surface items whose haystack lacks it.
    expect(filterArchivePhotoAlbumItems(items, { ...params, q: 'SAÚDE' }).map((i) => i.id)).toEqual(
      [1],
    )
    expect(
      filterArchivePhotoAlbumItems(items, { ...params, q: 'gabinete' }).map((i) => i.id),
    ).toEqual([3])
    // Combining facets narrows.
    expect(
      filterArchivePhotoAlbumItems(items, {
        ...params,
        municipio: 'salvador',
        atividade: 'visita',
        pessoa: 'rui-costa',
      }).map((i) => i.id),
    ).toEqual([2])
  })

  it('lists the active filters in canonical order and removal never keeps the overlay id', () => {
    const params = parseArchivePhotoAlbumParams({
      data: '2026-09-12',
      municipio: 'salvador',
      atividade: 'visita',
      pessoa: 'rui-costa',
      q: 'saúde',
      foto: '2',
    })
    const filters = archivePhotoAlbumActiveFilters(params, archivePhotoAlbumFacets(items))

    expect(filters.map((filter) => filter.facet)).toEqual([
      'data',
      'municipio',
      'atividade',
      'pessoa',
      'q',
    ])
    expect(filters[0]!.removeHref).toBe(
      '/fotos?municipio=salvador&atividade=visita&pessoa=rui-costa&q=sa%C3%BAde',
    )
    expect(filters[4]!.removeHref).toBe(
      '/fotos?data=2026-09-12&municipio=salvador&atividade=visita&pessoa=rui-costa',
    )
  })

  it('heads with the first criterion in the fixed precedence', () => {
    const facets = archivePhotoAlbumFacets(items)
    const params = parseArchivePhotoAlbumParams({})

    expect(archivePhotoAlbumHeading(params, facets)).toBe('Fotos da nossa caminhada')
    expect(archivePhotoAlbumHeading({ ...params, q: 'saúde' }, facets)).toBe(
      'Resultados para “saúde”',
    )
    expect(archivePhotoAlbumHeading({ ...params, data: '2026-09-12' }, facets)).toBe(
      'Fotos de 12 de setembro de 2026',
    )
    expect(archivePhotoAlbumHeading({ ...params, pessoa: 'rui-costa' }, facets)).toBe(
      'Fotos com Rui Costa',
    )
    expect(archivePhotoAlbumHeading({ ...params, atividade: 'plenaria' }, facets)).toBe(
      'Fotos de Plenária',
    )
    expect(
      archivePhotoAlbumHeading(
        { ...params, municipio: 'salvador', atividade: 'plenaria', q: 'saúde' },
        facets,
      ),
    ).toBe('Fotos em Salvador')
  })
})

describe('paginateArchivePhotoAlbumItems', () => {
  const many: ArchivePhotoPublicItem[] = Array.from(
    { length: ARCHIVE_PHOTO_ALBUM_PAGE_SIZE + 3 },
    (_, index) => item(index + 1),
  )

  it('slices 24 per page, clamps the page and reports the neighbours', () => {
    const first = paginateArchivePhotoAlbumItems(many, 1)
    expect(first.items).toHaveLength(ARCHIVE_PHOTO_ALBUM_PAGE_SIZE)
    expect(first.pageCount).toBe(2)
    expect(first.hasPrevious).toBe(false)
    expect(first.hasNext).toBe(true)

    const second = paginateArchivePhotoAlbumItems(many, 2)
    expect(second.items).toHaveLength(3)
    expect(second.hasPrevious).toBe(true)
    expect(second.hasNext).toBe(false)

    const beyond = paginateArchivePhotoAlbumItems(many, 99)
    expect(beyond.page).toBe(2)
    expect(beyond.hasNext).toBe(false)
  })

  it('keeps pageCount at 1 with zero items', () => {
    const empty = paginateArchivePhotoAlbumItems([], 4)
    expect(empty).toEqual({
      page: 1,
      pageCount: 1,
      items: [],
      hasPrevious: false,
      hasNext: false,
    })
  })
})
