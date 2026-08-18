// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  inlineCoverUrl,
  resolveCoverDownloadUrl,
  resolveCoverSource,
  resolveMediaCoverSources,
  slugFromFilename,
  stripHtml,
} from '../../scripts/lib/wpArticles.mjs'

describe('inlineCoverUrl (OPS52-media — first inline image of the article body)', () => {
  it('returns the src of the first <img>', () => {
    const html = '<p>dek</p><figure><img src="https://jorgesolla.com.br/cover.jpg"></figure>'
    expect(inlineCoverUrl(html)).toBe('https://jorgesolla.com.br/cover.jpg')
  })

  it('skips earlier paragraphs without images', () => {
    const html =
      '<p>texto sem imagem</p><p>mais texto</p><figure><img src="/rel.jpg" alt="x"></figure>'
    expect(inlineCoverUrl(html)).toBe('/rel.jpg')
  })

  it('returns null when the body has no image', () => {
    expect(inlineCoverUrl('<p>só texto</p>')).toBeNull()
    expect(inlineCoverUrl('')).toBeNull()
  })

  it('keeps relative URLs as-is (same contract as the seed)', () => {
    expect(inlineCoverUrl('<img src="/uploads/foo.webp">')).toBe('/uploads/foo.webp')
  })
})

describe('resolveCoverSource (OPS52-media — seed-identical cover resolution)', () => {
  it('prefers the REST featured media URL', () => {
    const article = {
      slug: 'x',
      title: 'x',
      date: null,
      html: '<p>sem img</p>',
      coverUrl: 'https://jorgesolla.com.br/featured.jpg',
      coverAlt: null,
    }
    expect(resolveCoverSource(article)).toBe('https://jorgesolla.com.br/featured.jpg')
  })

  it('falls back to the first inline image when there is no featured media', () => {
    const article = {
      slug: 'x',
      title: 'x',
      date: null,
      html: '<figure><img src="https://jorgesolla.com.br/inline.png"></figure>',
      coverUrl: null,
      coverAlt: null,
    }
    expect(resolveCoverSource(article)).toBe('https://jorgesolla.com.br/inline.png')
  })

  it('returns null when neither source exists', () => {
    const article = {
      slug: 'x',
      title: 'x',
      date: null,
      html: '<p>sem img</p>',
      coverUrl: null,
      coverAlt: null,
    }
    expect(resolveCoverSource(article)).toBeNull()
  })
})

describe('slugFromFilename (OPS52-media — deterministic seed key <slug>.<ext>)', () => {
  it('strips the last extension', () => {
    expect(slugFromFilename('solla-e-jeronimo-inauguram-mercado-publico-de-ubata.jpg')).toBe(
      'solla-e-jeronimo-inauguram-mercado-publico-de-ubata',
    )
  })

  it('keeps dots inside the slug', () => {
    expect(slugFromFilename('obra.2026.png')).toBe('obra.2026')
  })

  it('leaves filenames without an extension untouched', () => {
    expect(slugFromFilename('sem-extensao')).toBe('sem-extensao')
  })

  it('is case-insensitive about the extension', () => {
    expect(slugFromFilename('slug.JPG')).toBe('slug')
  })
})

describe('stripHtml (shared with the seed)', () => {
  it('collapses whitespace and strips tags', () => {
    expect(stripHtml('<p>Olá  <strong>mundo</strong></p>')).toBe('Olá mundo')
  })

  it('handles empty input', () => {
    expect(stripHtml('')).toBe('')
  })
})

describe('resolveCoverDownloadUrl (OPS52-media — covers constrained to the WP origin)', () => {
  it('keeps an absolute cover on the WordPress host', () => {
    expect(
      resolveCoverDownloadUrl('https://jorgesolla.com.br/wp-content/uploads/2026/07/x.jpeg'),
    ).toBe('https://jorgesolla.com.br/wp-content/uploads/2026/07/x.jpeg')
  })

  it('resolves relative covers against the WordPress origin', () => {
    expect(resolveCoverDownloadUrl('/wp-content/uploads/x.png')).toBe(
      'https://jorgesolla.com.br/wp-content/uploads/x.png',
    )
  })

  it('refuses covers on other hosts (no SSRF from the homeserver)', () => {
    expect(() => resolveCoverDownloadUrl('http://100.119.220.31:3900/internal')).toThrow(
      /fora do origin/,
    )
    expect(() => resolveCoverDownloadUrl('https://evil.example.com/x.png')).toThrow(
      /fora do origin/,
    )
  })

  it('refuses non-http(s) schemes', () => {
    expect(() => resolveCoverDownloadUrl('file:///etc/passwd')).toThrow(/protocolo/)
  })
})

describe('resolveMediaCoverSources (OPS52-media — row→cover mapping)', () => {
  const article = (slug: string) => ({
    slug,
    title: slug,
    date: null,
    html: '<figure><img src="https://jorgesolla.com.br/inline.png"></figure>',
    coverUrl: null,
    coverAlt: null,
  })
  const articlesBySlug = new Map([
    ['post-a', article('post-a')],
    ['post-b', article('post-b')],
  ])

  it('maps via the post coverImage relation (exact source)', () => {
    const rows = [{ id: 1, filename: 'post-a.jpg' }]
    const posts = [{ coverImage: 1, slug: 'post-a' }]
    const [entry] = resolveMediaCoverSources(rows, posts, articlesBySlug)
    expect(entry.source).toBe('post')
    expect(entry.slug).toBe('post-a')
    expect(entry.coverUrl).toBe('https://jorgesolla.com.br/inline.png')
  })

  it('falls back to the filename-derived slug for rows without a post', () => {
    const rows = [{ id: 2, filename: 'post-b.png' }]
    const [entry] = resolveMediaCoverSources(rows, [], articlesBySlug)
    expect(entry.source).toBe('filename')
    expect(entry.slug).toBe('post-b')
    expect(entry.coverUrl).toBe('https://jorgesolla.com.br/inline.png')
  })

  it('prefers the post relation over a matching filename slug', () => {
    const rows = [{ id: 1, filename: 'post-b.jpg' }]
    const posts = [{ coverImage: 1, slug: 'post-a' }]
    const [entry] = resolveMediaCoverSources(rows, posts, articlesBySlug)
    expect(entry.slug).toBe('post-a')
    expect(entry.source).toBe('post')
  })

  it('leaves unresolvable rows with no cover and source null', () => {
    const rows = [{ id: 3, filename: 'orphan.jpg' }]
    const [entry] = resolveMediaCoverSources(rows, [], articlesBySlug)
    expect(entry).toMatchObject({ slug: 'orphan', coverUrl: null, source: null })
  })
})
