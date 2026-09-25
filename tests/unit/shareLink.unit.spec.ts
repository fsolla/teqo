import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  isReservedShareLinkSlug,
  isValidShareLinkDestination,
  isValidShareLinkSlug,
  normalizeAbsoluteHttpUrl,
  normalizeShareLinkDescription,
  resolveLiveShareLinkDestination,
  resolveShareLinkMode,
  SHARE_LINK_MODES,
  SHARE_LINK_RESERVED_SLUGS,
  SHARE_LINK_SLUG_PATTERN,
  shareLinkIcsPath,
  shareLinkIcsUid,
  shareLinkPath,
} from '@/lib/shareLink'

describe('shareLink slug', () => {
  it('accepts lowercase kebab-case slugs', () => {
    expect(isValidShareLinkSlug('plenaria-saude-15-07')).toBe(true)
    expect(isValidShareLinkSlug('meet')).toBe(true)
    expect(isValidShareLinkSlug('a1')).toBe(true)
  })

  it.each([
    'Plenaria',
    'plenaria_saude',
    'plenaria--saude',
    '-plenaria',
    'plenaria-',
    '',
    'a/b',
    'a.b',
  ])('rejects %s', (value) => {
    expect(isValidShareLinkSlug(value)).toBe(false)
    expect(SHARE_LINK_SLUG_PATTERN.test(value)).toBe(false)
  })

  it('flags the reserved slugs literally', () => {
    expect([...SHARE_LINK_RESERVED_SLUGS].sort()).toEqual(
      [
        'abaixo-assinado',
        'admin',
        'api',
        'artigo',
        'artigos',
        'campanha',
        'cards',
        'conteudos',
        'corte',
        'evento',
        'jingles',
        'mandato-no-whatsapp',
        'noticia',
        'privacidade',
      ].sort(),
    )
    expect(isReservedShareLinkSlug('corte')).toBe(true)
    expect(isReservedShareLinkSlug('plenaria-saude')).toBe(false)
  })

  it('builds the single-segment public path', () => {
    expect(shareLinkPath('plenaria-saude')).toBe('/plenaria-saude')
  })
})

describe('shareLink destination', () => {
  it.each([
    'https://meet.google.com/abc-defg-hij',
    'http://example.com',
    'https://example.com/path?x=1#y',
  ])('accepts %s', (value) => {
    expect(isValidShareLinkDestination(value)).toBe(true)
  })

  it.each([
    'meet.google.com/abc',
    'ftp://example.com/file',
    'javascript:alert(1)',
    'data:text/html,x',
    'mailto:x@example.com',
    'http:foo',
    'https:example.com',
    'https://example.com/path\nX-Injected: yes',
    '',
  ])('rejects %s', (value) => {
    expect(isValidShareLinkDestination(value)).toBe(false)
  })

  it('normalizes absolute HTTP URLs and rejects control characters', () => {
    expect(normalizeAbsoluteHttpUrl(' https://example.com/path ')).toBe('https://example.com/path')
    expect(normalizeAbsoluteHttpUrl('https://example.com/path\r\nX-Injected: yes')).toBeNull()
  })
})

describe('shareLink mode (S29)', () => {
  it('treats a legacy/null value as direct and lists both modes', () => {
    expect(SHARE_LINK_MODES).toEqual(['direct', 'announcement'])
    expect(resolveShareLinkMode(null)).toBe('direct')
    expect(resolveShareLinkMode(undefined)).toBe('direct')
    expect(resolveShareLinkMode('direct')).toBe('direct')
    expect(resolveShareLinkMode('announcement')).toBe('announcement')
    expect(resolveShareLinkMode('outro')).toBe('direct')
  })
})

describe('resolveLiveShareLinkDestination (S29)', () => {
  it('returns the first live row with a valid http/https URL', () => {
    expect(
      resolveLiveShareLinkDestination([
        { label: 'Meet', url: 'https://meet.google.com/abc', live: false },
        { label: 'YouTube', url: 'https://youtube.com/live/x', live: true },
        { label: 'Outro', url: 'https://example.com/outro', live: true },
      ]),
    ).toEqual({ href: 'https://youtube.com/live/x', label: 'YouTube' })
  })

  it('fails closed on empty, unflagged or invalid rows', () => {
    expect(resolveLiveShareLinkDestination(null)).toBeNull()
    expect(resolveLiveShareLinkDestination([])).toBeNull()
    expect(resolveLiveShareLinkDestination([{ label: 'Meet', url: 'https://x.com' }])).toBeNull()
    expect(
      resolveLiveShareLinkDestination([{ label: 'X', url: 'javascript:alert(1)', live: true }]),
    ).toBeNull()
    expect(resolveLiveShareLinkDestination([{ live: true, url: null }])).toBeNull()
  })

  it('trims the URL and tolerates a missing label', () => {
    expect(resolveLiveShareLinkDestination([{ url: '  https://x.com/a  ', live: true }])).toEqual({
      href: 'https://x.com/a',
      label: '',
    })
  })
})

describe('shareLink ics contract (S29)', () => {
  it('hangs the download off the slug namespace', () => {
    expect(shareLinkIcsPath('plenaria-saude')).toBe('/plenaria-saude/evento.ics')
    expect(shareLinkIcsUid('plenaria-saude')).toBe('plenaria-saude@teqo.jorgesolla.com.br')
  })
})

describe('normalizeShareLinkDescription', () => {
  it('collapses newlines and repeated spaces so the meta tag stays single-line', () => {
    expect(normalizeShareLinkDescription('  Venha para a\n\nplenária   de saúde  ')).toBe(
      'Venha para a plenária de saúde',
    )
  })
})

describe('reserved slugs drift', () => {
  const ROUTE_FILES = new Set(['page.tsx', 'page.ts', 'route.ts', 'route.tsx'])

  /** Any route file below `dir` (dynamic segments included) makes the segment a URL. */
  const hasRouteFile = (dir: string): boolean => {
    if (!existsSync(dir)) return false

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && ROUTE_FILES.has(entry.name)) return true
      if (entry.isDirectory() && hasRouteFile(path.join(dir, entry.name))) return true
    }

    return false
  }

  const staticRouteSegments = (): string[] => {
    const roots = ['src/app/(frontend)', 'src/app/(frontend)/(home)']
    const segments = new Set<string>()

    for (const root of roots) {
      const absolute = path.resolve(process.cwd(), root)
      if (!existsSync(absolute)) continue

      for (const entry of readdirSync(absolute, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith('[') || entry.name.startsWith('('))
          continue

        if (hasRouteFile(path.join(absolute, entry.name))) segments.add(entry.name)
      }
    }

    return [...segments]
  }

  /** The post type enum is private to the server-only `posts.ts`; read it as source. */
  const postTypesOnDisk = (): string[] => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/utilities/posts.ts'), 'utf8')
    const match = source.match(/const POST_TYPES = \[([^\]]+)\]/)
    if (!match?.[1]) return []
    return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]!)
  }

  it('reserves every static route segment at the root of the public site', () => {
    const missing = staticRouteSegments().filter((segment) => !isReservedShareLinkSlug(segment))
    expect(missing).toEqual([])
  })

  it('reserves every post type value (the `[type]` branch answers them first)', () => {
    const types = postTypesOnDisk()
    expect(types).toEqual(['noticia', 'campanha', 'artigo', 'evento'])

    const missing = types.filter((type) => !isReservedShareLinkSlug(type))
    expect(missing).toEqual([])
  })
})
