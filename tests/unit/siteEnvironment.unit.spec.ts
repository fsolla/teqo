// @vitest-environment node

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import robots from '@/app/robots'
import { isStagingSite, isStagingSiteUrl } from '@/lib/siteEnvironment'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

describe('isStagingSiteUrl (OPS103)', () => {
  it('detects staging hostnames', () => {
    expect(isStagingSiteUrl('https://staging.jorgesolla1313.com.br')).toBe(true)
    expect(isStagingSiteUrl('http://staging.example.com:3000')).toBe(true)
    expect(isStagingSiteUrl('https://staging.jorgesolla1313.com.br/caminho?q=1')).toBe(true)
  })

  it('leaves production, staging-lookalikes and invalid origins indexable', () => {
    expect(isStagingSiteUrl('https://jorgesolla1313.com.br')).toBe(false)
    expect(isStagingSiteUrl('https://example.com/staging')).toBe(false)
    expect(isStagingSiteUrl('https://xstaging.example.com')).toBe(false)
    expect(isStagingSiteUrl(undefined)).toBe(false)
    expect(isStagingSiteUrl(null)).toBe(false)
    expect(isStagingSiteUrl('')).toBe(false)
    expect(isStagingSiteUrl('not-a-url')).toBe(false)
  })
})

describe('isStagingSite (OPS103)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads NEXT_PUBLIC_SITE_URL at call time (the identity each build carries)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.jorgesolla1313.com.br')
    expect(isStagingSite()).toBe(true)

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://jorgesolla1313.com.br')
    expect(isStagingSite()).toBe(false)
  })
})

describe('staging noindex wiring (OPS103)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('robots() disallows every path on staging and allows production', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://staging.jorgesolla1313.com.br')
    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' })

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://jorgesolla1313.com.br')
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/' })
  })

  it('robots.ts lives at the app-dir root and consumes the helper', () => {
    // Next 15 only recognizes metadata route files at the app-dir root (route
    // groups are not part of the match), so this path is load-bearing.
    const robotsSource = readFileSync(join(repoRoot, 'src/app/robots.ts'), 'utf8')
    expect(robotsSource).toContain("from '@/lib/siteEnvironment'")
    expect(robotsSource).toContain('isStagingSite')
  })

  it('the frontend layout flips robots.index off only for staging', () => {
    const layout = readFileSync(join(repoRoot, 'src/app/(frontend)/layout.tsx'), 'utf8')
    expect(layout).toContain("from '@/lib/siteEnvironment'")
    // Pin the exact ternary: presence of `index: false` and `index: true`
    // somewhere would survive an inverted condition.
    expect(layout).toContain(
      'robots: isStagingSite() ? { index: false, follow: false } : { index: true, follow: true },',
    )
  })
})
