import 'server-only'

import type { Payload } from 'payload'

import type { FaceSearchSubject } from '@/lib/faceSearch'

/**
 * C234 — server reads of the enrolled subjects behind the selfie search. The
 * collection is admin-only, so every read here is the Local API without a user
 * (the documented anonymous-read bypass, same precedent as
 * `archivePhotoReads`): the SELECTOR is the search request itself, never an
 * actor. The rows are few (one per adhered person) and the search must see the
 * live state — no cache, so an opt-out stops answering immediately.
 */

/** A relationship value at depth 0 is the id; tolerate the populated shape. */
const relationIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []

  const ids: number[] = []
  for (const entry of value) {
    if (typeof entry === 'number') {
      ids.push(entry)
      continue
    }
    if (entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'number') {
      ids.push(entry.id)
    }
  }
  return ids
}

export type FaceSubjectSummary = {
  id: number
  status: string | null
  model: string | null
  consentHash: string | null
  enrolledAt: string | null
  vector: unknown
  matchedPhotoIds: number[]
}

type FaceSubjectDoc = {
  id: number
  status?: string | null
  model?: string | null
  consentHash?: string | null
  enrolledAt?: string | null
  vector?: unknown
  matchedPhotos?: unknown
}

const toSummary = (doc: FaceSubjectDoc): FaceSubjectSummary => ({
  id: doc.id,
  status: doc.status ?? null,
  model: doc.model ?? null,
  consentHash: doc.consentHash ?? null,
  enrolledAt: doc.enrolledAt ?? null,
  vector: doc.vector,
  matchedPhotoIds: relationIds(doc.matchedPhotos),
})

const faceSubjectSelect = {
  status: true,
  model: true,
  consentHash: true,
  enrolledAt: true,
  vector: true,
  matchedPhotos: true,
} as const

/** Every subject (any status) — the CLI inventory and the batch's fresh read. */
export const listFaceSubjects = async (
  payload: Payload,
  req?: { transactionID?: number | string },
): Promise<FaceSubjectSummary[]> => {
  const result = await payload.find({
    collection: 'faceSubject',
    sort: ['id'],
    depth: 0,
    limit: 0,
    pagination: false,
    select: faceSubjectSelect,
    // Intentional bypass: subjects are admin-only configuration and both the
    // search (anonymous request) and the CLI (no session) must read them.
    overrideAccess: true,
    req,
  })

  return result.docs.map((doc) => toSummary(doc as FaceSubjectDoc))
}

/** Active subjects only — the candidate set of one search. */
export const listSearchableFaceSubjects = async (
  payload: Payload,
): Promise<FaceSearchSubject[]> => {
  const result = await payload.find({
    collection: 'faceSubject',
    where: { status: { equals: 'active' } },
    sort: ['id'],
    depth: 0,
    limit: 0,
    pagination: false,
    select: { status: true, model: true, consentHash: true, vector: true },
    // Intentional bypass: the search endpoint answers anonymous requests and
    // the selector is the consent-gated query itself, never an actor.
    overrideAccess: true,
  })

  return result.docs.map((doc) => ({
    id: doc.id,
    status: doc.status ?? null,
    model: doc.model ?? null,
    consentHash: doc.consentHash ?? null,
    vector: doc.vector,
  }))
}

/** The approved photos linked to one subject (the search answer). */
export const getFaceSubjectMatchedPhotoIds = async (
  payload: Payload,
  id: number,
): Promise<number[]> => {
  const doc = await payload
    .findByID({
      collection: 'faceSubject',
      id,
      depth: 0,
      select: { matchedPhotos: true },
      // Intentional bypass: same anonymous-read rationale as the list above.
      overrideAccess: true,
    })
    .catch(() => null)

  return relationIds((doc as FaceSubjectDoc | null)?.matchedPhotos)
}
