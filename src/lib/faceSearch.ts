/**
 * C234 — pure contract of the selfie search over the public photo album.
 *
 * The visitor's face descriptor is computed on their own device (the selfie
 * never leaves it); the server only ever sees the 128-float vector and answers
 * with photos, never with a score. This module owns the wire vocabulary (the
 * descriptor length, the model id, the intents), the distance math, the
 * eligibility of an enrolled subject (active + current model + current consent
 * hash — fail-closed on any of the three), the result view model (which by
 * SHAPE cannot carry a similarity number or a third-party name) and the
 * deterministic stub the e2e build uses in place of the engine.
 *
 * Scope lock of the gate (PR #1370): only consented/indexed faces exist in the
 * index (A/C); the anonymous-archive index (B) is out. The vector of the
 * visitor is never persisted — it lives in the request only.
 */
import type { ArchivePhotoPublicItem } from '@/lib/archivePhotoPublicCatalog'

/** face-api's faceRecognitionNet descriptor (128 floats, euclidean space). */
export const FACE_SEARCH_DESCRIPTOR_LENGTH = 128

/** The engine+model the enrolled vectors belong to — a match across models is void. */
export const FACE_SEARCH_MODEL = 'face-api@1.7.15/faceRecognitionNet'

/**
 * Internal similarity threshold (face-api's usual 0.6 is a permissive default;
 * the feature prefers missing a match over showing the wrong person). Never
 * serialized: no caller of this contract receives a distance.
 */
export const FACE_SEARCH_MAX_DISTANCE = 0.45

/** Ceiling of photos in one answer; the oldest beyond it stay only in the album. */
export const FACE_SEARCH_RESULT_LIMIT = 60

/**
 * Detector tuning shared by the browser engine and the CLI engine: they must
 * load the same three nets with the same options, otherwise the descriptors of
 * the selfie and of the archive would live in different spaces.
 */
export const FACE_DETECTOR_INPUT_SIZE = 512
export const FACE_DETECTOR_SCORE_THRESHOLD = 0.3

/** Same-origin directory the browser engine loads the model files from. */
export const FACE_MODEL_DIR = '/fotos/modelos'

export const FACE_SEARCH_INTENTS = ['search', 'leave-index'] as const

/**
 * A stored/requested descriptor: exactly `FACE_SEARCH_DESCRIPTOR_LENGTH` finite
 * numbers, or nothing (fail-closed — a wrong-length or poisoned vector never
 * reaches the math).
 */
export const readFaceVector = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length !== FACE_SEARCH_DESCRIPTOR_LENGTH) return null

  const vector: number[] = []
  for (const component of value) {
    if (typeof component !== 'number' || !Number.isFinite(component)) return null
    vector.push(component)
  }
  return vector
}

/** Euclidean distance of same-length descriptors; a length mismatch is never a match. */
export const faceEuclideanDistance = (a: readonly number[], b: readonly number[]): number => {
  if (a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY

  let sum = 0
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index]
    sum += delta * delta
  }
  return Math.sqrt(sum)
}

export type FaceSearchSubject = {
  id: number
  status?: string | null
  model?: string | null
  consentHash?: string | null
  vector?: unknown
}

/**
 * A subject only answers while it is `active`, was enrolled with the model the
 * query belongs to and its consent snapshot is still the configured text
 * (editing the Consent text invalidates every enrolled descriptor until the
 * person is re-consented — fail-closed).
 */
export const faceSubjectIsEligible = (
  subject: FaceSearchSubject,
  { model, consentHash }: { model: string; consentHash: string },
): boolean =>
  subject.status === 'active' && subject.model === model && subject.consentHash === consentHash

/**
 * The best eligible subject strictly under `maxDistance`, or null. Subject
 * order breaks nothing: the comparison is strict, so only a closer subject
 * replaces the current best.
 */
export const findFaceMatch = ({
  vector,
  subjects,
  model,
  consentHash,
}: {
  vector: readonly number[]
  subjects: readonly FaceSearchSubject[]
  model: string
  consentHash: string
}): FaceSearchSubject | null => {
  let best: FaceSearchSubject | null = null
  let bestDistance = FACE_SEARCH_MAX_DISTANCE

  for (const subject of subjects) {
    if (!faceSubjectIsEligible(subject, { model, consentHash })) continue
    const candidate = readFaceVector(subject.vector)
    if (!candidate) continue

    const distance = faceEuclideanDistance(vector, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = subject
    }
  }

  return best
}

/**
 * What one matched photo looks like to the visitor: the album's public view
 * minus the third-party names (`people`/`peopleLabel`) and minus anything
 * numeric — the shape is the guardrail.
 */
export type FaceSearchPhotoView = {
  id: number
  alt: string
  title: string
  takenOn: string | null
  shortDateLabel: string | null
  municipalityName: string | null
  sceneLabel: string | null
  metaLabel: string
  thumbnailPath: string
  mediaPath: string
  downloadPath: string
  downloadFilename: string
}

export const toFaceSearchPhotoView = (item: ArchivePhotoPublicItem): FaceSearchPhotoView => ({
  id: item.id,
  alt: item.alt,
  title: item.title,
  takenOn: item.takenOn,
  shortDateLabel: item.shortDateLabel,
  municipalityName: item.municipalityName,
  sceneLabel: item.sceneLabel,
  metaLabel: item.metaLabel,
  thumbnailPath: item.thumbnailPath,
  mediaPath: item.mediaPath,
  downloadPath: item.downloadPath,
  downloadFilename: item.downloadFilename,
})

/**
 * Deterministic stand-in for the on-device engine (`NEXT_PUBLIC_FACE_SEARCH_STUB=1`,
 * e2e builds only): the same bytes always derive the same descriptor, so the
 * spec can seed a subject whose vector equals the fixture's without ever
 * loading a model. Never used outside the stub seam.
 */
export const faceStubDescriptorFromBytes = (bytes: Uint8Array): number[] => {
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  let state = hash || 0x9e3779b9
  const vector: number[] = []
  for (let index = 0; index < FACE_SEARCH_DESCRIPTOR_LENGTH; index += 1) {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    vector.push((state / 0xffffffff) * 2 - 1)
  }
  return vector
}
