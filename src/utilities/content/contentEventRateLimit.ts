import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

/**
 * C213 — the best-effort throttle of the public beacon endpoint. The counters
 * are advisory, so this is a bar-raiser, not a quota: the window is generous
 * (a real visitor produces a handful of events; carrier NAT can hold many
 * visitors behind one IP), it fails OPEN when no client IP is trustworthy, and
 * it never throws — a limiter failure must not turn a count into an error.
 *
 * The IP is NEVER persisted: it is hashed with a per-process random salt and
 * the digest lives only in this process's memory, resetting on deploy. No IP,
 * no digest and no header ever reaches the database or a log.
 */

const WINDOW_MS = 10 * 60 * 1000
const MAX_EVENTS_PER_WINDOW = 120

/**
 * Ceiling for the in-memory registry: a spoofed-IP flood cannot grow it
 * without bound. Past the ceiling, a NEW key is simply not tracked (fail-open
 * for that client) while the already-tracked ones keep their windows.
 */
const MAX_TRACKED_CLIENTS = 10_000

const processSalt = randomBytes(16).toString('hex')

type RateLimitWindow = { count: number; resetAt: number }

const store = new Map<string, RateLimitWindow>()

/** The tunnel sets `cf-connecting-ip`; the generic proxies use the X- family. */
export const contentEventClientKey = (headers: Headers): string | null => {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip =
    headers.get('cf-connecting-ip')?.trim() || forwarded || headers.get('x-real-ip')?.trim()
  if (!ip) return null

  return createHash('sha256').update(`${processSalt}:${ip}`).digest('hex')
}

const cleanup = (now: number): void => {
  for (const [key, window] of store) {
    if (now >= window.resetAt) store.delete(key)
  }
}

/**
 * `true` when the event may be recorded. A null key (no trustworthy IP) and
 * any internal failure answer `true` — the fail-open contract.
 */
export const checkContentEventRateLimit = (key: string | null): boolean => {
  if (!key) return true

  try {
    const now = Date.now()
    cleanup(now)

    const existing = store.get(key)
    if (!existing || now >= existing.resetAt) {
      if (!existing && store.size >= MAX_TRACKED_CLIENTS) return true
      store.set(key, { count: 1, resetAt: now + WINDOW_MS })
      return true
    }
    if (existing.count >= MAX_EVENTS_PER_WINDOW) return false

    existing.count += 1
    return true
  } catch {
    return true
  }
}
