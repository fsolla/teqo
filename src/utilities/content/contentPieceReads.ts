import 'server-only'

import {
  toContentPiecePublicItem,
  type ContentPiecePublicItem,
  type ContentPiecePublicSource,
} from '@/lib/contentPieceCatalog'
import { getCollectionListingTag } from '@/utilities/documents'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

/**
 * S27 — public reads of the Central de Conteúdos. The collection has no public
 * access (`canReadContentPiece` is campaign-only), so the anonymous read is the
 * Local API without `user` — the bypass default — and the gate is the query
 * plus the `contentPieceIsPublic` predicate: only `publicado` with an archived
 * file or the platform link ever leaves here. Same precedent as `jingleReads`.
 *
 * The listing is cached under the collection listing tag (`contentPieces`,
 * busted by the ContentPiece afterChange on every publish/unpublish/edit), and
 * the slug read resolves from the SAME cached list: the hook does not bust a
 * per-document tag, so one tag keeps the whole surface honest.
 */

const contentPiecePublicSelect = {
  slug: true,
  title: true,
  type: true,
  status: true,
  origin: true,
  topics: true,
  cityLabel: true,
  region: true,
  institution: true,
  description: true,
  transcript: true,
  sourceUrl: true,
  durationSeconds: true,
  pieceDate: true,
  searchText: true,
  media: true,
} as const

const findPublishedContentPieces = () =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.find({
      collection: 'contentPiece',
      where: { status: { equals: 'publicado' } },
      sort: ['-publishedAt', '-id'],
      depth: 1,
      limit: 0,
      pagination: false,
      select: contentPiecePublicSelect,
    }),
  )

const getCachedPublishedContentPieces = () =>
  unstable_cache(findPublishedContentPieces, ['content-pieces'], {
    tags: [getCollectionListingTag('contentPiece')],
  })

/**
 * The published records with the raw fields the public surface needs
 * (`transcript`/`description` included, for the S28 theme provenance). The
 * caller maps them into view models — with or without theme terms.
 */
export const getPublishedContentPieceRecords = async (): Promise<ContentPiecePublicSource[]> => {
  const { docs } = await getCachedPublishedContentPieces()()
  return docs
}

/** Published pieces as serializable public view models, newest first. */
export const getPublishedContentPieceItems = async (): Promise<ContentPiecePublicItem[]> =>
  (await getPublishedContentPieceRecords())
    .map((piece) => toContentPiecePublicItem(piece))
    .filter((item): item is ContentPiecePublicItem => item !== null)

/**
 * One published piece by its public slug. A draft (no slug), an unpublished
 * piece and an unknown slug all resolve to null — the page turns that into the
 * same honest not-found screen, never revealing whether the piece existed.
 */
export const getPublishedContentPieceBySlug = async (
  slug: string,
): Promise<ContentPiecePublicItem | null> =>
  (await getPublishedContentPieceItems()).find((item) => item.slug === slug) ?? null

/**
 * Discovery flag for the footer link and the header badge: derived from the
 * SAME resolved list the page renders, so a piece that cannot render never
 * advertises a link to an empty Central.
 */
export const hasPublishedContentPieces = async (): Promise<boolean> =>
  (await getPublishedContentPieceItems()).length > 0
