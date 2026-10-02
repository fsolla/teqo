import 'server-only'

import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { FACE_INDEX_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import {
  findFaceFigureMatches,
  groupFaceFigureMatchesByPhoto,
  type FaceFigure,
  type PhotoFigureMatch,
} from '@/lib/faceFigureCatalog'
import { getConsentByKey } from '@/utilities/campaignConsent'
import { getCollectionListingTag } from '@/utilities/documents'
import { loadFaceDescriptorIndex } from '@/utilities/faceIndex/faceDescriptorReads'
import configPromise from '@payload-config'

/**
 * C244 — the read that turns the curated `faceFigure` catalog plus the C242
 * anonymous descriptor index into the album's per-photo "who appears" map. The
 * matching is pure math (`findFaceFigureMatches`) over the already-cached
 * descriptor index; the result is cached under the album listing tag, so a
 * figure edit, a photo lifecycle write or a batch run that busts `archivePhotos`
 * recomputes it once — never per visit.
 *
 * The public-notice Consent is checked OUTSIDE the cache and fails closed: with
 * no `busca-selfie-indice` row the map is empty (nobody is named), and
 * provisioning the notice takes effect immediately, without a deploy.
 */

const faceFigureSelect = {
  name: true,
  slug: true,
  active: true,
  references: true,
} as const

const toFaceFigure = (doc: {
  name: string
  slug: string
  active?: boolean | null
  references?: readonly { model?: string | null; vector?: unknown }[] | null
}): FaceFigure => ({
  slug: doc.slug,
  name: doc.name,
  active: doc.active ?? null,
  references: (doc.references ?? []).map((reference) => ({
    model: reference.model ?? null,
    vector: reference.vector,
  })),
})

const computeApprovedPhotoFigureMatches = async (): Promise<PhotoFigureMatch[]> => {
  const payload = await getPayload({ config: configPromise })
  const figuresResult = await payload.find({
    collection: 'faceFigure',
    where: { active: { equals: true } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: faceFigureSelect,
    // Intentional bypass: the public album read has no actor; the selector is
    // the curated catalog itself (admin-only collection).
    overrideAccess: true,
  })

  const figures = figuresResult.docs.map(toFaceFigure)
  // No reference at all: nobody can match, so the descriptor index is not read.
  if (!figures.some((figure) => (figure.references ?? []).length > 0)) return []

  const descriptors = await loadFaceDescriptorIndex(payload)
  return groupFaceFigureMatchesByPhoto(findFaceFigureMatches({ figures, descriptors }))
}

const getCachedApprovedPhotoFigureMatches = () =>
  unstable_cache(computeApprovedPhotoFigureMatches, ['archive-photo-figures'], {
    tags: [getCollectionListingTag('archivePhoto')],
  })

/**
 * The per-photo curated figures of the approved album, or an empty map when the
 * public notice Consent is missing or the index cannot be read — the facet and
 * "Quem aparece" disappear; the album itself never breaks.
 */
export const loadApprovedPhotoFigureMap = async (): Promise<PhotoFigureMatch[]> => {
  const payload = await getPayload({ config: configPromise })
  const notice = await getConsentByKey(payload, FACE_INDEX_CONSENT_KEY)
  if (!notice) return []

  try {
    return await getCachedApprovedPhotoFigureMatches()()
  } catch {
    return []
  }
}
