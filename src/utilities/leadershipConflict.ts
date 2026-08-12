import 'server-only'

/**
 * C128 — shared leadership identity-conflict matcher. Was private to
 * `actions/leadership.ts` (create path); the person lifecycle
 * (`setPersonLeadershipMunicipalitiesRecord`) creates leaderships too, and the
 * `contact` unique violation must map to the same safe message in both
 * surfaces. Lives outside the 'use server' module because a plain const cannot
 * be re-exported from one (Next.js allows only async function exports there).
 */

export const isUniqueLeadershipConflict = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  if (/leadership_contact|duplicate key/i.test(message)) {
    return true
  }

  if (!(error instanceof Error) || error.name !== 'ValidationError') return false

  return /contact(?:_id)?/i.test(JSON.stringify(error))
}
