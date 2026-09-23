// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildContentPieceCatalogHref,
  contentPieceCatalogActiveFilters,
  contentPieceCatalogFacets,
  contentPieceDownloadFilename,
  contentPieceMediaKind,
  contentPieceMediaPath,
  contentPiecePublicPath,
  contentPieceTextExcerpt,
  filterContentPieceCatalogItems,
  parseContentPieceCatalogParams,
  toContentPiecePublicItem,
  type ContentPiecePublicItem,
  type ContentPiecePublicSource,
} from '@/lib/contentPieceCatalog'

const source = (patch: Partial<ContentPiecePublicSource> = {}): ContentPiecePublicSource => ({
  id: 1,
  slug: 'fim-da-escala-6x1',
  title: 'Fim da escala 6x1 é saúde',
  type: 'video',
  status: 'publicado',
  origin: 'arquivo',
  topics: ['economia-trabalho'],
  cityLabel: 'Salvador',
  region: 'Metropolitano de Salvador',
  description: 'Solla explica a jornada.',
  transcript: 'A redução da jornada é saúde.',
  durationSeconds: 134,
  searchText: 'fim da escala 6x1 e saude salvador',
  media: { id: 7, filename: 'Fim da Escala.MP4' },
  ...patch,
})

const item = (patch: Partial<ContentPiecePublicSource> = {}): ContentPiecePublicItem => {
  const resolved = toContentPiecePublicItem(source(patch))
  if (!resolved) throw new Error('fixture should be public')
  return resolved
}

describe('content piece catalog params', () => {
  it('parses one valid value per facet and drops unknown values', () => {
    expect(
      parseContentPieceCatalogParams({
        tipo: ['video', 'foto'],
        cidade: 'salvador',
        regiao: 'metropolitano-de-salvador',
        tema: 'economia-trabalho',
        instituicao: 'camara-dos-deputados',
        q: '  escala  ',
      }),
    ).toEqual({
      tipo: 'video',
      cidade: 'salvador',
      regiao: 'metropolitano-de-salvador',
      tema: 'economia-trabalho',
      instituicao: 'camara-dos-deputados',
      q: 'escala',
    })

    expect(parseContentPieceCatalogParams({ tipo: 'inexistente', tema: 'nada' })).toEqual({
      tipo: null,
      cidade: null,
      regiao: null,
      tema: null,
      instituicao: null,
      q: '',
    })
    expect(parseContentPieceCatalogParams({ cidade: '../etc/passwd' }).cidade).toBeNull()
    expect(parseContentPieceCatalogParams({}).q).toBe('')
  })

  it('builds the canonical href with a fixed order and no empty params', () => {
    expect(buildContentPieceCatalogHref({})).toBe('/conteudos')
    expect(buildContentPieceCatalogHref({ q: '   ' })).toBe('/conteudos')
    expect(
      buildContentPieceCatalogHref({
        q: 'escala',
        tema: 'economia-trabalho',
        tipo: 'video',
        cidade: 'salvador',
      }),
    ).toBe('/conteudos?tipo=video&cidade=salvador&tema=economia-trabalho&q=escala')
    expect(buildContentPieceCatalogHref({ tipo: 'video', tema: null, q: '' })).toBe(
      '/conteudos?tipo=video',
    )
  })

  it('lists the active filters with their removal hrefs', () => {
    const items = [
      item(),
      item({ id: 2, slug: 'card', type: 'card', topics: ['saude'], cityLabel: null }),
    ]
    const params = parseContentPieceCatalogParams({
      tipo: 'video',
      cidade: 'salvador',
      q: 'escala',
    })
    const filters = contentPieceCatalogActiveFilters(params, contentPieceCatalogFacets(items))

    expect(filters.map((filter) => `${filter.label}: ${filter.value}`)).toEqual([
      'Tipo: Vídeo',
      'Cidade: Salvador',
      'Busca: escala',
    ])
    expect(filters[0]?.removeHref).toBe('/conteudos?cidade=salvador&q=escala')
    expect(filters[2]?.removeHref).toBe('/conteudos?tipo=video&cidade=salvador')
  })
})

describe('content piece catalog facets', () => {
  it('derives options from published items only, in enum/alphabetical order', () => {
    const facets = contentPieceCatalogFacets([
      item(),
      item({
        id: 2,
        slug: 'card-saude',
        type: 'card',
        topics: ['saude'],
        cityLabel: 'Feira de Santana',
        region: 'Portal do Sertão',
        institution: 'Câmara dos Deputados',
      }),
    ])

    expect(facets.tipo).toEqual([
      { value: 'video', label: 'Vídeo' },
      { value: 'card', label: 'Card' },
    ])
    expect(facets.tema.map((option) => option.label)).toEqual(['Saúde', 'Economia e Trabalho'])
    expect(facets.cidade.map((option) => option.label)).toEqual(['Feira de Santana', 'Salvador'])
    expect(facets.regiao.map((option) => option.label)).toEqual([
      'Metropolitano de Salvador',
      'Portal do Sertão',
    ])
    expect(facets.instituicao).toEqual([
      { value: 'camara-dos-deputados', label: 'Câmara dos Deputados' },
    ])
  })
})

describe('content piece catalog filtering', () => {
  const items = [
    item(),
    item({
      id: 2,
      slug: 'card-feira',
      title: 'Card do giro',
      type: 'card',
      topics: ['saude'],
      cityLabel: 'Feira de Santana',
      searchText: 'card do giro saude feira de santana',
    }),
    item({
      id: 3,
      slug: 'link-yt',
      origin: 'youtube',
      media: null,
      sourceUrl: 'https://youtu.be/X',
      searchText: 'video no youtube',
    }),
  ]

  const idsFor = (raw: Record<string, string>) =>
    filterContentPieceCatalogItems(items, parseContentPieceCatalogParams(raw)).map((row) => row.id)

  it('combines facets and the accent-insensitive term', () => {
    expect(idsFor({})).toEqual([1, 2, 3])
    expect(idsFor({ tipo: 'video' })).toEqual([1, 3])
    expect(idsFor({ tema: 'saude' })).toEqual([2])
    expect(idsFor({ cidade: 'feira-de-santana' })).toEqual([2])
    expect(idsFor({ q: 'ESCALA' })).toEqual([1])
    expect(idsFor({ q: 'saúde' })).toEqual([1, 2])
    expect(idsFor({ tipo: 'video', cidade: 'feira-de-santana' })).toEqual([])
    expect(idsFor({ tipo: 'video', q: 'escala' })).toEqual([1])
  })
})

describe('content piece public view model', () => {
  it('resolves the file piece with paths, duration and metadata line', () => {
    const view = item()

    expect(view.isLink).toBe(false)
    expect(view.typeLabel).toBe('Vídeo')
    expect(view.durationLabel).toBe('02:14')
    expect(view.metaLabel).toBe('Economia e Trabalho · Salvador')
    expect(view.publicPath).toBe('/conteudos/fim-da-escala-6x1')
    expect(view.file?.path).toBe('/conteudos/fim-da-escala-6x1/midia')
    expect(view.file?.mimeType).toBeNull()
    expect(view.file?.downloadFilename).toBe('jorge-solla-1313-fim-da-escala-6x1.mp4')
  })

  it('resolves a link piece with the platform URL and no media', () => {
    const view = item({
      origin: 'instagram',
      media: null,
      sourceUrl: 'https://www.instagram.com/reel/ABC/',
      transcript: null,
    })

    expect(view.isLink).toBe(true)
    expect(view.originLabel).toBe('Instagram')
    expect(view.file).toBeNull()
  })

  it('resolves the media kind from the stored MIME with a type fallback', () => {
    expect(contentPieceMediaKind(item({ media: { id: 7, mimeType: 'video/mp4' } }))).toBe('video')
    expect(contentPieceMediaKind(item({ media: { id: 7, mimeType: 'audio/mpeg' } }))).toBe('audio')
    expect(contentPieceMediaKind(item({ media: { id: 7, mimeType: 'image/webp' } }))).toBe('image')
    expect(contentPieceMediaKind(item({ media: { id: 7, mimeType: 'text/plain' } }))).toBe('text')
    expect(contentPieceMediaKind(item({ media: { id: 7, mimeType: 'application/pdf' } }))).toBe(
      'other',
    )
    // No MIME stored: the editorial type decides.
    expect(contentPieceMediaKind(item({ media: { id: 7 } }))).toBe('video')
    expect(contentPieceMediaKind(item({ type: 'card', media: { id: 7 } }))).toBe('image')
    expect(contentPieceMediaKind(item({ media: null, sourceUrl: 'https://youtu.be/X' }))).toBeNull()
  })

  it('fails closed without a slug or without file and link', () => {
    expect(toContentPiecePublicItem(source({ slug: null }))).toBeNull()
    expect(toContentPiecePublicItem(source({ status: 'rascunho' }))).toBeNull()
    expect(toContentPiecePublicItem(source({ media: null }))).toBeNull()
    expect(toContentPiecePublicItem(source({ media: null, sourceUrl: null }))).toBeNull()
    expect(
      toContentPiecePublicItem(source({ media: null, sourceUrl: 'https://youtu.be/X' }))?.isLink,
    ).toBe(true)
  })

  it('keeps the text excerpt short and the download name legible', () => {
    expect(contentPieceTextExcerpt('\n  “Saúde é direito.”  \nSegunda linha')).toBe(
      '“Saúde é direito.”',
    )
    expect(contentPieceTextExcerpt('')).toBeNull()
    expect(contentPieceTextExcerpt('a'.repeat(200))?.endsWith('…')).toBe(true)
    expect(contentPieceDownloadFilename('card-feira', 'Card Final.PNG')).toBe(
      'jorge-solla-1313-card-feira.png',
    )
    expect(contentPieceDownloadFilename('sem-extensao', null)).toBe(
      'jorge-solla-1313-sem-extensao.bin',
    )
    expect(contentPiecePublicPath('x')).toBe('/conteudos/x')
    expect(contentPieceMediaPath('x')).toBe('/conteudos/x/midia')
  })
})
