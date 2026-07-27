// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'

import { SITE_METADATA_DEFAULTS, absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
  }
})

describe('resolveSiteMetadata', () => {
  it('returns defaults and null siteUrl when the global is empty and env is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    const resolved = resolveSiteMetadata({})

    expect(resolved).toEqual({
      siteUrl: null,
      title: SITE_METADATA_DEFAULTS.title,
      siteName: SITE_METADATA_DEFAULTS.siteName,
      description: SITE_METADATA_DEFAULTS.description,
      twitterCreator: SITE_METADATA_DEFAULTS.twitterCreator,
      twitterDescription: SITE_METADATA_DEFAULTS.description,
      keywords: [],
    })
  })

  it('falls back to NEXT_PUBLIC_SITE_URL when the global has no URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'

    const resolved = resolveSiteMetadata({})

    expect(resolved.siteUrl).toBe('https://example.com')
  })

  it('prefers the global URL over the env fallback and strips trailing slashes', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example/'

    const resolved = resolveSiteMetadata({ URL: 'https://global.example///' })

    expect(resolved.siteUrl).toBe('https://global.example')
  })

  it('treats blank URL / env as missing', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   '

    expect(resolveSiteMetadata({ URL: '  ' }).siteUrl).toBeNull()
  })

  it('fills textual fields when openGraph / twitter / description are absent', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    const resolved = resolveSiteMetadata({ URL: 'https://jorgesolla.com.br' })

    expect(resolved.siteUrl).toBe('https://jorgesolla.com.br')
    expect(resolved.siteName).toBe(SITE_METADATA_DEFAULTS.siteName)
    expect(resolved.twitterCreator).toBe(SITE_METADATA_DEFAULTS.twitterCreator)
    expect(resolved.description).toBe(SITE_METADATA_DEFAULTS.description)
  })

  it('preserves populated fields from a complete global', () => {
    const resolved = resolveSiteMetadata({
      URL: 'https://jorgesolla.com.br',
      title: 'Site Title',
      description: 'Site description',
      keywords: [{ keyword: 'bahia' }, 'saude', { keyword: null }, null, '  '],
      openGraph: { siteName: 'OG Name' },
      twitter: { creator: '@creator', description: 'Twitter desc' },
    })

    expect(resolved).toEqual({
      siteUrl: 'https://jorgesolla.com.br',
      title: 'Site Title',
      siteName: 'OG Name',
      description: 'Site description',
      twitterCreator: '@creator',
      twitterDescription: 'Twitter desc',
      keywords: ['bahia', 'saude'],
    })
  })

  it('flattens null / empty keywords to an empty list', () => {
    expect(resolveSiteMetadata({ keywords: null }).keywords).toEqual([])
    expect(resolveSiteMetadata({ keywords: [] }).keywords).toEqual([])
  })
})

describe('absoluteSitePath', () => {
  it('returns undefined when siteUrl is null', () => {
    expect(absoluteSitePath(null, '/noticia')).toBeUndefined()
  })

  it('joins origin and path without doubling slashes', () => {
    expect(absoluteSitePath('https://example.com', '/noticia')).toBe('https://example.com/noticia')
    expect(absoluteSitePath('https://example.com', 'noticia')).toBe('https://example.com/noticia')
  })
})
