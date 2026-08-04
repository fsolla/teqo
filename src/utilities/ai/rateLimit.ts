/**
 * In-memory rate limiter for the AI chat endpoint.
 * Survives a single instance; resets on deploy. Sufficient for v1 abuse prevention.
 */

type RateLimitWindow = {
  count: number
  resetAt: number
}

const store = new Map<number, RateLimitWindow>()

const MAX_MESSAGES = 50
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

/** Cleans up expired windows. Called on every check to prevent memory leaks. */
const cleanup = (now: number) => {
  for (const [userId, window] of store) {
    if (now >= window.resetAt) {
      store.delete(userId)
    }
  }
}

/**
 * Returns `true` if the user is within their rate limit.
 * Returns `false` if they've exceeded it.
 */
export const checkRateLimit = (userId: number): boolean => {
  const now = Date.now()
  cleanup(now)

  const existing = store.get(userId)

  if (!existing || now >= existing.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (existing.count >= MAX_MESSAGES) {
    return false
  }

  existing.count++
  return true
}
