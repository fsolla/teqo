// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  createThemeSearchGuard,
  isThemeSearchRequestEligible,
  themeSearchClientKey,
} from '@/utilities/ai/themeSearchGuard'

const navigation = (extra: Record<string, string> = {}) =>
  new Headers({ 'sec-fetch-mode': 'navigate', ...extra })

const termsResolver = (terms: string[]) => vi.fn(async () => ({ terms }))

describe('theme search eligibility (S28)', () => {
  it('accepts the document navigation and the router RSC fetch', () => {
    expect(isThemeSearchRequestEligible(navigation())).toBe(true)
    // A client-side navigation arrives as `cors` (Next consumes the RSC header
    // before userland, so it cannot be the signal).
    expect(isThemeSearchRequestEligible(new Headers({ 'sec-fetch-mode': 'cors' }))).toBe(true)

    expect(isThemeSearchRequestEligible(new Headers())).toBe(false)
    expect(isThemeSearchRequestEligible(new Headers({ 'user-agent': 'curl/8' }))).toBe(false)
    // A foreign `<link rel=prefetch>`/`<img>` must never trigger an expansion.
    expect(isThemeSearchRequestEligible(new Headers({ 'sec-fetch-mode': 'no-cors' }))).toBe(false)
    expect(isThemeSearchRequestEligible(new Headers({ 'sec-fetch-mode': 'same-origin' }))).toBe(
      false,
    )
  })

  it('refuses an explicit Next prefetch header when the platform exposes it', () => {
    expect(isThemeSearchRequestEligible(navigation({ 'next-router-prefetch': '1' }))).toBe(false)
  })
})

describe('theme search client key (S28)', () => {
  it('prefers the edge IP header and falls back to the proxy headers', () => {
    expect(
      themeSearchClientKey(
        new Headers({
          'cf-connecting-ip': '203.0.113.7',
          'x-forwarded-for': '198.51.100.9, 10.0.0.1',
          'x-real-ip': '10.0.0.2',
        }),
      ),
    ).toBe('203.0.113.7')
    expect(themeSearchClientKey(new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' }))).toBe(
      '198.51.100.9',
    )
    expect(themeSearchClientKey(new Headers({ 'x-real-ip': '10.0.0.2' }))).toBe('10.0.0.2')
  })

  it('shares the fail-closed bucket when no IP header exists', () => {
    expect(themeSearchClientKey(new Headers())).toBe('unknown')
  })
})

describe('theme search guard (S28)', () => {
  it('degrades without calling the resolver when the request is ineligible', async () => {
    const guard = createThemeSearchGuard()
    const expandTheme = termsResolver(['saúde'])

    await expect(
      guard.resolve({ q: 'SUS', headers: new Headers(), expandTheme }),
    ).resolves.toBeNull()
    expect(expandTheme).not.toHaveBeenCalled()
  })

  it('does not spend the quota on an ineligible request', async () => {
    const guard = createThemeSearchGuard({ max: 1 })
    const expandTheme = termsResolver(['saúde'])

    await guard.resolve({ q: 'bot', headers: new Headers(), expandTheme })
    await expect(guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })).resolves.toEqual({
      terms: ['saúde'],
    })
  })

  it('expands once and serves the same normalized term from the cache', async () => {
    const guard = createThemeSearchGuard()
    const expandTheme = termsResolver(['saúde pública'])

    await expect(guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })).resolves.toEqual({
      terms: ['saúde pública'],
    })
    await expect(
      guard.resolve({ q: '  sus ', headers: navigation(), expandTheme }),
    ).resolves.toEqual({ terms: ['saúde pública'] })
    expect(expandTheme).toHaveBeenCalledTimes(1)
  })

  it('does not consume quota on a cache hit', async () => {
    const guard = createThemeSearchGuard({ max: 1 })
    const expandTheme = termsResolver(['saúde'])

    await guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })
    // The quota is spent; the cached term still resolves.
    await expect(guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })).resolves.toEqual({
      terms: ['saúde'],
    })
    // A fresh term is refused.
    await expect(
      guard.resolve({ q: 'escola', headers: navigation(), expandTheme }),
    ).resolves.toBeNull()
  })

  it('caches a legitimate empty list and never caches unavailability', async () => {
    const guard = createThemeSearchGuard()
    const empty = termsResolver([])
    const unavailable = vi.fn(async () => null)

    await expect(
      guard.resolve({ q: 'nada', headers: navigation(), expandTheme: empty }),
    ).resolves.toEqual({ terms: [] })
    await guard.resolve({ q: 'nada', headers: navigation(), expandTheme: empty })
    expect(empty).toHaveBeenCalledTimes(1)

    await expect(
      guard.resolve({ q: 'falha', headers: navigation(), expandTheme: unavailable }),
    ).resolves.toBeNull()
    await guard.resolve({ q: 'falha', headers: navigation(), expandTheme: unavailable })
    expect(unavailable).toHaveBeenCalledTimes(2)
  })

  it('limits the expansions per client and resets after the window', async () => {
    let now = 1_000
    const guard = createThemeSearchGuard({ max: 2, windowMs: 60_000, now: () => now })
    const expandTheme = termsResolver(['saúde'])

    await guard.resolve({ q: 'um', headers: navigation(), expandTheme })
    await guard.resolve({ q: 'dois', headers: navigation(), expandTheme })
    await expect(
      guard.resolve({ q: 'tres', headers: navigation(), expandTheme }),
    ).resolves.toBeNull()
    expect(expandTheme).toHaveBeenCalledTimes(2)

    now += 60_000
    await expect(guard.resolve({ q: 'tres', headers: navigation(), expandTheme })).resolves.toEqual(
      { terms: ['saúde'] },
    )
  })

  it('expires the cached expansion after the TTL', async () => {
    let now = 1_000
    const guard = createThemeSearchGuard({ ttlMs: 30_000, now: () => now })
    const expandTheme = termsResolver(['saúde'])

    await guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })
    now += 30_000
    await guard.resolve({ q: 'SUS', headers: navigation(), expandTheme })
    expect(expandTheme).toHaveBeenCalledTimes(2)
  })

  it('caps the cache and evicts the oldest term', async () => {
    const guard = createThemeSearchGuard({ maxEntries: 1 })
    const expandTheme = termsResolver(['saúde'])

    await guard.resolve({ q: 'um', headers: navigation(), expandTheme })
    await guard.resolve({ q: 'dois', headers: navigation(), expandTheme })
    await guard.resolve({ q: 'um', headers: navigation(), expandTheme })
    expect(expandTheme).toHaveBeenCalledTimes(3)
  })
})
