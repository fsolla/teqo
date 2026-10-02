import 'server-only'

import {
  toArchivePhotoPublicItem,
  type ArchivePhotoPublicItem,
  type ArchivePhotoPublicPerson,
  type ArchivePhotoPublicSource,
} from '@/lib/archivePhotoPublicCatalog'
import { getCollectionListingTag } from '@/utilities/documents'
import { loadApprovedPhotoFigureMap } from '@/utilities/faceIndex/faceFigureReads'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

/**
 * C233 — the public reads of the photo album. The collection has no public
 * access (`canReadArchivePhoto` is campaign-only), so the anonymous read is the
 * Local API without `user` — the bypass default — and the gate is the query
 * plus the `archivePhotoIsPublic` predicate inside the mapper: only an
 * `approved` photo ever leaves here. Same precedent as `contentPieceReads`.
 *
 * The listing is cached under the collection listing tag (`archivePhotos`,
 * busted by the ArchivePhoto afterChange/afterDelete on every edit), and the
 * by-id read resolves from the SAME cached list: one tag keeps the whole
 * surface honest, so an `approved→removed` edit pulls the photo down with it.
 * The municipality snapshot on the row (`municipalityName/Slug`) is why this
 * read never touches the campaign-only `municipality` collection.
 */

const archivePhotoPublicSelect = {
  alt: true,
  takenOn: true,
  municipalityName: true,
  municipalitySlug: true,
  filename: true,
  publicationStatus: true,
  searchText: true,
  catalog: true,
} as const

const findApprovedArchivePhotos = () =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.find({
      collection: 'archivePhoto',
      where: { publicationStatus: { equals: 'approved' } },
      sort: ['-takenOn', '-id'],
      depth: 0,
      limit: 0,
      pagination: false,
      select: archivePhotoPublicSelect,
    }),
  )

const getCachedApprovedArchivePhotos = () =>
  unstable_cache(findApprovedArchivePhotos, ['archive-photos'], {
    tags: [getCollectionListingTag('archivePhoto')],
  })

const toApprovedItems = (
  docs: readonly ArchivePhotoPublicSource[],
  figuresByPhoto?: ReadonlyMap<number, readonly ArchivePhotoPublicPerson[]>,
): ArchivePhotoPublicItem[] =>
  docs
    .map((source) => {
      if (!figuresByPhoto) return toArchivePhotoPublicItem(source)
      return toArchivePhotoPublicItem({
        ...source,
        figures: figuresByPhoto.get(source.id) ?? [],
      })
    })
    .filter((item): item is ArchivePhotoPublicItem => item !== null)

/** Approved photos as serializable public view models, newest first. */
export const getApprovedArchivePhotoItems = async (): Promise<ArchivePhotoPublicItem[]> =>
  toApprovedItems((await getCachedApprovedArchivePhotos()()).docs)

/**
 * C244 — the same approved list, enriched with the curated public figures
 * recognized in each photo by the facial layer (`loadApprovedPhotoFigureMap`).
 * Only the album route uses this: the selfie endpoint and the media route stay
 * on the plain read and never pay for the matching.
 */
export const getApprovedArchivePhotoAlbumItems = async (): Promise<ArchivePhotoPublicItem[]> => {
  const [result, photoFigureMatches] = await Promise.all([
    getCachedApprovedArchivePhotos()(),
    loadApprovedPhotoFigureMap(),
  ])

  const figuresByPhoto = new Map<number, readonly ArchivePhotoPublicPerson[]>()
  for (const match of photoFigureMatches) {
    figuresByPhoto.set(match.photoId, match.figures)
  }

  return toApprovedItems(result.docs, figuresByPhoto)
}

/**
 * One approved photo by id (the overlay and the media gate). A draft, a
 * removed photo, an unknown id and a delete all resolve to null — the caller
 * turns that into the same silent 404/omitted overlay.
 */
export const getApprovedArchivePhotoById = async (
  id: number,
): Promise<ArchivePhotoPublicItem | null> =>
  (await getApprovedArchivePhotoItems()).find((item) => item.id === id) ?? null

/** Discovery flag for the footer link: the same resolved list the page renders. */
export const hasPublishedArchivePhotos = async (): Promise<boolean> =>
  (await getApprovedArchivePhotoItems()).length > 0
