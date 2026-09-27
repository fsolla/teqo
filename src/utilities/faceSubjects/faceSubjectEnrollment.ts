import 'server-only'

import type { Payload } from 'payload'

import { FACE_SEARCH_MODEL, readFaceVector } from '@/lib/faceSearch'

/**
 * C234 — writes of the subject lifecycle: enrollment (one row per person who
 * adhered to the search index — A/C scope of the gate) and the removal that
 * serves the person's own opt-out. Enrollment is called only by
 * `pnpm faces:enroll`, after the CLI has proven the selfie has exactly one
 * detectable face and resolved the enrollment Consent by its stable key; the
 * removal is called by the search endpoint after the request's descriptor
 * matched the subject (the face IS the authentication). Neither path takes the
 * descriptor from any other source and the row is never public.
 *
 * Re-enrollment (`subjectId`) replaces the descriptor, refreshes the consent
 * snapshot and clears the derived links: the previous matches belong to the
 * previous descriptor and must never survive it. `enrolledAt` also advances —
 * it is the batch's staleness key, so the next `faces:index` recomputes.
 */
export type FaceSubjectEnrollmentInput = {
  payload: Payload
  label: string
  descriptor: readonly number[]
  consent: { id: number; contentHash: string }
  subjectId?: number | null
}

export type FaceSubjectEnrollment = {
  id: number
  created: boolean
}

export const enrollFaceSubject = async ({
  payload,
  label,
  descriptor,
  consent,
  subjectId,
}: FaceSubjectEnrollmentInput): Promise<FaceSubjectEnrollment> => {
  const vector = readFaceVector(descriptor)
  if (!vector) throw new Error('Descriptor inválido para enrollment.')

  const data = {
    label,
    consent: consent.id,
    consentHash: consent.contentHash,
    model: FACE_SEARCH_MODEL,
    vector,
    enrolledAt: new Date().toISOString(),
    status: 'active' as const,
    removedAt: null,
    matchedPhotos: [] as number[],
  }

  // Intentional bypass: the enrollment CLI is a trusted operator with no
  // session; the descriptor is validated above and never crosses the wire.
  const common = { depth: 0 as const, overrideAccess: true }

  if (subjectId != null) {
    const updated = await payload.update({
      collection: 'faceSubject',
      id: subjectId,
      data,
      ...common,
    })
    return { id: updated.id, created: false }
  }

  const created = await payload.create({ collection: 'faceSubject', data, ...common })
  return { id: created.id, created: true }
}

/**
 * Opt-out: the subject stops answering (the query checks `status`) and stops
 * holding biometrics (the vector and the derived links are erased). The row
 * itself stays as the attendance record. One row, one update — atomic by
 * itself, no transaction needed.
 */
export const removeFaceSubjectFromIndex = async ({
  payload,
  id,
}: {
  payload: Payload
  id: number
}): Promise<void> => {
  await payload.update({
    collection: 'faceSubject',
    id,
    data: {
      status: 'removed',
      vector: null,
      removedAt: new Date().toISOString(),
      matchedPhotos: [],
    },
    depth: 0,
    // Intentional bypass: the search endpoint is anonymous and the removal is
    // authorized by the matched descriptor, never by a session.
    overrideAccess: true,
  })
}
