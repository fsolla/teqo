import 'server-only'

import { normalizeForSearch } from '@/lib/speechSearch'
import type { ThemeSearchExpansionResolver } from '@/utilities/ai/expandSpeechSearchTheme'

/**
 * S28 — the anonymous guard of the public theme search. The Central de Conteúdos
 * has no login and the expansion is an LLM call, so the mode needs a use limit
 * and must never be driven by a bot/crawler/prefetch. Both the limiter and the
 * expansion cache are in-memory (single self-hosted instance; reset on deploy,
 * same contract as `rateLimit.ts`) and live outside `unstable_cache` because
 * they read request headers. Overflow always degrades to the literal search —
 * never a 429 in the voter's face.
 */

/** The headers subset the guard reads (a `Headers` instance satisfies it). */
export type ThemeSearchHeaders = Pick<Headers, 'get'>

const PREFETCH_HEADER = 'next-router-prefetch'
const FETCH_MODE_HEADER = 'sec-fetch-mode'
/** Borda (Cloudflare tunnel) first: not forgeable by the client. */
const CLIENT_IP_HEADERS = ['cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'] as const

const THEME_SEARCH_MAX_EXPANSIONS = 8
const THEME_SEARCH_WINDOW_MS = 15 * 60 * 1000
const THEME_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000
const THEME_SEARCH_CACHE_MAX_ENTRIES = 200

/**
 * A theme expansion only runs for a browser-initiated request. Next 15 consumes
 * `RSC`/`Next-Router-Prefetch` before userland (`headers()` never sees them —
 * verified against the running app), so the gate is the Fetch Metadata that
 * does arrive: `navigate` (a document load, JS-less form GET included) or
 * `cors` (the router's RSC fetch — the same one a client-side navigation uses,
 * which must expand). `no-cors` is refused so a foreign `<link rel=prefetch>`
 * or an `<img>` cannot trigger an expansion, and a scraper without the
 * Sec-Fetch headers stays literal. The first line against Next's own prefetch
 * is the UI: every theme-preserving link renders with `prefetch={false}`, since
 * the router's prefetch is indistinguishable from a navigation here.
 */
export const isThemeSearchRequestEligible = (headers: ThemeSearchHeaders): boolean => {
  if (headers.get(PREFETCH_HEADER)) return false
  const mode = headers.get(FETCH_MODE_HEADER)
  return mode === 'navigate' || mode === 'cors'
}

/**
 * Anonymous client key for the limiter: the edge IP headers in order, with the
 * first `x-forwarded-for` hop as the first fallback. Missing all of them shares
 * the `unknown` bucket (fail-closed: the tightest limit applies).
 */
export const themeSearchClientKey = (headers: ThemeSearchHeaders): string => {
  for (const name of CLIENT_IP_HEADERS) {
    const value = headers.get(name)?.split(',')[0]?.trim()
    if (value) return value
  }
  return 'unknown'
}

type ThemeSearchWindow = {
  count: number
  resetAt: number
}

type ThemeSearchCacheEntry = {
  terms: string[]
  expiresAt: number
}

export type ThemeSearchGuardOptions = {
  max?: number
  windowMs?: number
  ttlMs?: number
  maxEntries?: number
  /** Injectable clock for the unit tests. */
  now?: () => number
}

type ResolveThemeExpansionInput = {
  q: string
  headers: ThemeSearchHeaders
  expandTheme: ThemeSearchExpansionResolver
}

export type ThemeSearchGuard = {
  /**
   * `{ terms }` when the expansion ran (or was served from the cache) — the
   * empty list included — and `null` whenever the caller must degrade to the
   * literal search with the notice (ineligible request, quota, unavailable).
   */
  resolve: (input: ResolveThemeExpansionInput) => Promise<{ terms: string[] } | null>
}

export const createThemeSearchGuard = (options: ThemeSearchGuardOptions = {}): ThemeSearchGuard => {
  const max = options.max ?? THEME_SEARCH_MAX_EXPANSIONS
  const windowMs = options.windowMs ?? THEME_SEARCH_WINDOW_MS
  const ttlMs = options.ttlMs ?? THEME_SEARCH_CACHE_TTL_MS
  const maxEntries = options.maxEntries ?? THEME_SEARCH_CACHE_MAX_ENTRIES
  const now = options.now ?? Date.now

  const windows = new Map<string, ThemeSearchWindow>()
  const cache = new Map<string, ThemeSearchCacheEntry>()

  const cleanWindows = (at: number) => {
    for (const [key, entry] of windows) {
      if (at >= entry.resetAt) windows.delete(key)
    }
  }

  const cleanCache = (at: number) => {
    for (const [key, entry] of cache) {
      if (at >= entry.expiresAt) cache.delete(key)
    }
  }

  /** A hit does not consume quota: the provider call was already paid for. */
  const withinLimit = (clientKey: string, at: number): boolean => {
    const existing = windows.get(clientKey)
    if (!existing || at >= existing.resetAt) {
      windows.set(clientKey, { count: 1, resetAt: at + windowMs })
      return true
    }
    if (existing.count >= max) return false
    existing.count += 1
    return true
  }

  const resolve = async ({
    q,
    headers,
    expandTheme,
  }: ResolveThemeExpansionInput): Promise<{ terms: string[] } | null> => {
    if (!isThemeSearchRequestEligible(headers)) return null

    const theme = q.trim()
    const cacheKey = normalizeForSearch(theme)
    if (!cacheKey) return null

    const at = now()
    cleanCache(at)
    const cached = cache.get(cacheKey)
    if (cached) return { terms: cached.terms }

    cleanWindows(at)
    if (!withinLimit(themeSearchClientKey(headers), at)) return null

    const expansion = await expandTheme(theme)
    // `null` is transient (missing key/timeout/provider error): never cached.
    if (!expansion) return null

    if (cache.size >= maxEntries) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(cacheKey, { terms: expansion.terms, expiresAt: now() + ttlMs })

    return { terms: expansion.terms }
  }

  return { resolve }
}

/**
 * The process-wide guard: one in-memory limiter and cache, reset on deploy. The
 * cache key is the normalized public query (no PII, no user id); a `null`
 * expansion is never stored, so a later request can retry.
 */
export const resolveGuardedThemeExpansion = createThemeSearchGuard().resolve
