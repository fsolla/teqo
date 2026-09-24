import 'server-only'

import type { DataFromCollectionSlug, Payload, SelectType } from 'payload'

import { canReadCommunicationCatalog } from '@/lib/campaignRoles'
import { getCampaignUser } from '@/utilities/campaignAuth'
import type { PrivateMediaFile } from '@/utilities/privateMedia/privateMediaResponse'

/**
 * The private upload collections the gate serves. Deliberately a closed union
 * (not `CollectionSlug`): keeping the domain narrow is what makes the generic
 * `findByID` readable to the compiler and documents which doors exist.
 */
type PrivateMediaCollectionSlug = 'contentPiece' | 'recording' | 'reel' | 'speech'

/**
 * C216-FOLLOWUP-DRY — the single owner of the fail-closed gate every private
 * media GET route repeats: authenticates the campaign actor, refuses a
 * malformed id, reads the row with `overrideAccess: false` and answers `null`
 * for EVERY denial (the route maps it to its silent 404, so the response never
 * leaks which artifacts exist). The caller injects only what is its own: the
 * collection, the optional `select`, the eligibility predicate (`isServable`,
 * mandatory so every new route has to declare its own eligibility — explicitly
 * `() => true` when the domain has no kill switch) and the media field picker
 * (`artifactOf`).
 *
 * The HTTP contract (range, disposition, 404) stays in the route — this helper
 * never builds a response.
 */
export const loadPrivateMediaForActor = async <
  TSlug extends PrivateMediaCollectionSlug,
  TMedia extends PrivateMediaFile,
>({
  payload,
  collection,
  id,
  select,
  isServable,
  artifactOf,
}: {
  payload: Payload
  collection: TSlug
  id: number
  /** Keep the row light: the routes only need the status/origin + media fields. */
  select?: SelectType
  isServable: (doc: DataFromCollectionSlug<TSlug>) => boolean
  artifactOf: (doc: DataFromCollectionSlug<TSlug>) => TMedia | number | null | undefined
}): Promise<{ doc: DataFromCollectionSlug<TSlug>; media: TMedia } | null> => {
  const user = await getCampaignUser()
  if (!user || !canReadCommunicationCatalog(user.role)) return null

  if (!Number.isInteger(id) || id <= 0) return null

  const doc = await payload
    .findByID({
      collection,
      id,
      depth: 1,
      ...(select ? { select } : {}),
      user,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!doc || !isServable(doc)) return null

  const artifact = artifactOf(doc)
  if (!artifact || typeof artifact !== 'object') return null

  return { doc, media: artifact }
}
