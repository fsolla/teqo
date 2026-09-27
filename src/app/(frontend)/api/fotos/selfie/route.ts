import config from '@payload-config'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { FACE_INDEX_CONSENT_KEY, FACE_SEARCH_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import {
  FACE_SEARCH_MODEL,
  FACE_SEARCH_RESULT_LIMIT,
  findFaceMatch,
  toFaceSearchPhotoView,
} from '@/lib/faceSearch'
import { faceSearchRequestSchema } from '@/lib/schemas/faceSearch'
import { getApprovedArchivePhotoItems } from '@/utilities/archivePhotos/archivePhotoReads'
import { readBoundedRequestBody } from '@/utilities/boundedRequestBody'
import { getConsentByKey } from '@/utilities/campaignConsent'
import {
  checkContentEventRateLimit,
  contentEventClientKey,
} from '@/utilities/content/contentEventRateLimit'
import { removeFaceSubjectFromIndex } from '@/utilities/faceSubjects/faceSubjectEnrollment'
import {
  getFaceSubjectMatchedPhotoIds,
  listSearchableFaceSubjects,
} from '@/utilities/faceSubjects/faceSubjectReads'
import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

export const dynamic = 'force-dynamic'

/**
 * C234 — the anonymous endpoint of the selfie search. The browser computes the
 * face descriptor ON DEVICE (the selfie image never reaches this server) and
 * sends only the 128-float vector plus the intent; the answer is a list of
 * approved photos, never a score and never a third-party name.
 *
 * Fail-closed in layers: same-origin, bounded body, strict schema, a budget
 * much stricter than the beacon's (the endpoint answers a membership oracle),
 * the album's `selfieSearchEnabled` kill switch AND the query Consent resolved
 * server-side — the page closing is convenience, this is the gate. Scope A/C
 * of the gate (PR #1370): only subjects enrolled with consent answer; the
 * anonymous archive index (B) does not exist. `leave-index` is authorized by
 * the matched descriptor itself.
 */

const NO_STORE = { 'Cache-Control': 'no-store' } as const

/** The descriptor JSON is ~2 KB; anything past 4 KB is not ours. */
const MAX_BODY_BYTES = 4 * 1024

/** Requests per 10-minute window per hashed IP — strict on purpose. */
const FACE_SEARCH_REQUESTS_PER_WINDOW = 20

const jsonResponse = (body: unknown, status = 200): NextResponse =>
  NextResponse.json(body, { status, headers: NO_STORE })

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isSameOriginRequest(request)) return jsonResponse({ ok: false, error: 'origin' }, 403)

  const rawBody = await readBoundedRequestBody(request, MAX_BODY_BYTES)
  if (rawBody === null) return jsonResponse({ ok: false, error: 'body' }, 400)

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ ok: false, error: 'body' }, 400)
  }

  const parsed = faceSearchRequestSchema.safeParse(body)
  if (!parsed.success) return jsonResponse({ ok: false, error: 'body' }, 400)

  // The registry/hash owner is shared with the beacon, but the budget window is
  // NOT: the caller namespaces its key so beacon events and selfie searches
  // never consume each other's counters.
  const clientKey = contentEventClientKey(request.headers)
  if (
    !checkContentEventRateLimit(clientKey && `selfie:${clientKey}`, FACE_SEARCH_REQUESTS_PER_WINDOW)
  ) {
    return jsonResponse({ ok: false, error: 'rate-limited' }, 429)
  }

  const payload = await getPayload({ config })
  // Direct read (no cache): the kill switch and the consent must be the state
  // of this moment — the endpoint is the gate, the page is convenience. The
  // album global's read access is public by contract, so no bypass is needed.
  const [album, searchConsent] = await Promise.all([
    payload.findGlobal({ slug: 'photoAlbum', depth: 0 }).catch(() => null),
    getConsentByKey(payload, FACE_SEARCH_CONSENT_KEY),
  ])

  if (album?.published === false || album?.selfieSearchEnabled !== true) {
    return jsonResponse({ ok: false, error: 'closed' }, 404)
  }
  if (!searchConsent) return jsonResponse({ ok: false, error: 'consent' }, 503)

  const [subjects, indexConsent] = await Promise.all([
    listSearchableFaceSubjects(payload),
    getConsentByKey(payload, FACE_INDEX_CONSENT_KEY),
  ])

  const match = indexConsent
    ? findFaceMatch({
        vector: parsed.data.vector,
        subjects,
        model: FACE_SEARCH_MODEL,
        consentHash: indexConsent.contentHash,
      })
    : null

  if (parsed.data.intent === 'leave-index') {
    if (!match) return jsonResponse({ ok: true, removed: false })
    await removeFaceSubjectFromIndex({ payload, id: match.id })
    return jsonResponse({ ok: true, removed: true })
  }

  if (!match) return jsonResponse({ ok: true, found: false })

  const [matchedIds, approved] = await Promise.all([
    getFaceSubjectMatchedPhotoIds(payload, match.id),
    getApprovedArchivePhotoItems(),
  ])
  const linked = new Set(matchedIds)
  const photos = approved
    .filter((item) => linked.has(item.id))
    .slice(0, FACE_SEARCH_RESULT_LIMIT)
    .map(toFaceSearchPhotoView)

  if (photos.length === 0) return jsonResponse({ ok: true, found: false })

  return jsonResponse({ ok: true, found: true, photos })
}
