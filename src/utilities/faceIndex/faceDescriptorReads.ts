import 'server-only'

import type { Payload } from 'payload'

import {
  FACE_SEARCH_MAX_DISTANCE,
  FACE_SEARCH_MODEL,
  faceEuclideanDistance,
  findFaceDescriptorPhotoIds,
  readFaceVector,
  type FaceDescriptorEntry,
} from '@/lib/faceSearch'
import { revalidateArchivePhotosListing } from '@/utilities/documents'

/**
 * C242 — reads of the anonymous face index. The collection is admin-only and
 * machine-written, so every read is the Local API without a user (the same
 * anonymous-read bypass precedent as `archivePhotoReads`): the SELECTOR is the
 * search request itself, never an actor.
 *
 * The full set is loaded once per short window into an in-process cache
 * (`Float32Array` descriptors): the ranking is exact and linear — no pgvector
 * (C229 precedent) — and the TTL keeps an opt-out or a new index run visible
 * without a deploy. The opt-out path never uses the cache: it re-reads and
 * deletes in the same pass, because "leave-index" must take effect immediately.
 */

/** How long a loaded index answers before a re-read; short on purpose. */
const INDEX_CACHE_TTL_MS = 60_000

/**
 * Defensive ceiling: the flat cache costs ~600 bytes per face, so half a
 * million faces would be ~300 MB. Past the cap the search fails closed rather
 * than answering from a truncated index. The real archive (~6.5k photos) sits
 * orders of magnitude below it.
 */
const MAX_INDEXED_DESCRIPTORS = 300_000

type FaceDescriptorCache = {
  loadedAt: number
  entries: FaceDescriptorEntry[]
}

let descriptorCache: FaceDescriptorCache | null = null

/** Test seam: a fresh read after a fixture write in the same process. */
export const invalidateFaceDescriptorIndex = (): void => {
  descriptorCache = null
}

const relationId = (value: unknown): number | null => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') {
    return value.id
  }
  return null
}

const loadFaceDescriptorIndexFromDb = async (payload: Payload): Promise<FaceDescriptorEntry[]> => {
  const result = await payload.find({
    collection: 'archivePhotoFace',
    where: { model: { equals: FACE_SEARCH_MODEL } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { photo: true, vector: true },
    // Intentional bypass: the search endpoint answers anonymous requests and
    // the selector is the consent-gated query itself, never an actor.
    overrideAccess: true,
  })

  if (result.docs.length > MAX_INDEXED_DESCRIPTORS) {
    throw new Error(
      `Índice facial acima do teto defensivo (${result.docs.length} > ${MAX_INDEXED_DESCRIPTORS}).`,
    )
  }

  const entries: FaceDescriptorEntry[] = []
  for (const doc of result.docs) {
    const photoId = relationId(doc.photo)
    const vector = readFaceVector(doc.vector)
    if (photoId === null || vector === null) continue
    entries.push({ photoId, vector: Float32Array.from(vector) })
  }
  return entries
}

/** The current index, from the short-lived in-process cache when fresh. */
export const loadFaceDescriptorIndex = async (payload: Payload): Promise<FaceDescriptorEntry[]> => {
  const now = Date.now()
  if (descriptorCache && now - descriptorCache.loadedAt < INDEX_CACHE_TTL_MS) {
    return descriptorCache.entries
  }

  const entries = await loadFaceDescriptorIndexFromDb(payload)
  descriptorCache = { loadedAt: now, entries }
  return entries
}

/**
 * The distinct approved-photo ids the query vector matches, in index order.
 * Pure math on the loaded index; the caller intersects with the approved album
 * read (draft/removed never leave this function as a result).
 */
export const findMatchedFacePhotoIds = ({
  vector,
  entries,
}: {
  vector: ArrayLike<number>
  entries: readonly FaceDescriptorEntry[]
}): number[] => findFaceDescriptorPhotoIds(vector, entries)

/**
 * Opt-out ("leave-index"): the person's own descriptor is the authorization —
 * every indexed face under the threshold is deleted and the person stops being
 * found. Reads and deletes in one pass, never from the cache; returns how many
 * faces were erased (never which photos: the answer is not a score nor a list
 * of third-party places).
 */
export const deleteFaceDescriptorMatches = async ({
  payload,
  vector,
}: {
  payload: Payload
  vector: ArrayLike<number>
}): Promise<number> => {
  const result = await payload.find({
    collection: 'archivePhotoFace',
    where: { model: { equals: FACE_SEARCH_MODEL } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { vector: true },
    // Intentional bypass: same anonymous-request rationale as the load above;
    // the deletion itself is authorized by the matched descriptor.
    overrideAccess: true,
  })

  const matchedIds: number[] = []
  for (const doc of result.docs) {
    const stored = readFaceVector(doc.vector)
    if (!stored) continue
    if (faceEuclideanDistance(vector, stored) < FACE_SEARCH_MAX_DISTANCE) {
      matchedIds.push(doc.id)
    }
  }
  if (matchedIds.length === 0) return 0

  await payload.delete({
    collection: 'archivePhotoFace',
    where: { id: { in: matchedIds } },
    depth: 0,
    // Intentional bypass: the search endpoint is anonymous and the removal is
    // authorized by the matched descriptor, never by a session.
    overrideAccess: true,
  })
  invalidateFaceDescriptorIndex()
  // C244 — the curated-figure map of the public album is derived from these
  // rows and cached under the album tag: without this bust the person would
  // keep being named in the facet after leaving the index.
  revalidateArchivePhotosListing()
  return matchedIds.length
}
