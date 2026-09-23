import 'server-only'

import type { Payload } from 'payload'

import { toContentPieceViewModel, type ContentPieceViewModel } from '@/lib/contentPiece'
import { CONTENT_PIECE_NOT_FOUND_MESSAGE } from '@/lib/schemas/contentPiece'
import type { CampaignUser } from '@/payload-types'
import { type RawSearchParams } from '@/utilities/campaignListUrl'
import {
  buildContentPieceListWhere,
  contentPiecePageSize,
  parseContentPieceListParams,
  resolveContentPieceListUrl,
  type ContentPieceListState,
} from '@/utilities/content/contentPieceListUrl'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'

/**
 * Lean `select` of the list: everything the row view model renders. `cityLabel`
 * and `searchText` are denormalized on the row, so the list never joins.
 */
const contentPieceListSelect = {
  title: true,
  type: true,
  status: true,
  processingStatus: true,
  step: true,
  origin: true,
  topics: true,
  cityLabel: true,
  region: true,
  durationSeconds: true,
  pieceDate: true,
  publishedAt: true,
  error: true,
  media: true,
} as const

/** Everything the ficha renders, including the editable catalogue. */
const contentPieceDetailSelect = {
  ...contentPieceListSelect,
  slug: true,
  description: true,
  transcript: true,
  institution: true,
  sourceUrl: true,
  municipality: true,
  curatedFields: true,
} as const

export const ContentPieceNotFoundError = createEntityNotFoundError(
  'Content piece',
  CONTENT_PIECE_NOT_FOUND_MESSAGE,
)

/**
 * The município options of the ficha: the seeded, read-only geography list
 * (435 rows — one per Bahia municipality, Salvador split by TSE zone), read
 * once per ficha render.
 */
export const loadContentPieceFormOptions = async (
  payload: Payload,
): Promise<{ municipalities: { id: number; name: string }[] }> => {
  const result = await payload.find({
    collection: 'municipality',
    depth: 0,
    limit: 500,
    pagination: false,
    sort: 'name',
    select: { name: true },
    // Intentional admin bypass: the município catalog is read-only geography.
    overrideAccess: true,
  })
  return { municipalities: result.docs.map((doc) => ({ id: doc.id, name: doc.name })) }
}

export type ContentPieceListPageData = {
  rows: ContentPieceViewModel[]
  state: ContentPieceListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
}

/**
 * C211 — the Central list: every piece (drafts included — the ficha is where
 * the kill switch is reversed), newest first, with the search term and the
 * facet filters. The render path is read-only: a stale `processando` row is
 * repaired by the status poll (`getContentPieceStatusesForActor`), which the
 * list's refresher calls while something is moving.
 */
export const loadContentPieceListPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<RawSearchParams> | RawSearchParams,
): Promise<ContentPieceListPageData> => {
  const rawSearchParams = await searchParams
  const state = parseContentPieceListParams(rawSearchParams)
  const where = buildContentPieceListWhere(state)

  const result = await payload.find({
    collection: 'contentPiece',
    depth: 0,
    limit: contentPiecePageSize,
    page: state.page,
    sort: '-createdAt',
    where,
    select: contentPieceListSelect,
    user,
    overrideAccess: false,
  })
  const resolvedUrl = resolveContentPieceListUrl(rawSearchParams, result.totalPages)

  return {
    rows: result.docs.map((doc) => toContentPieceViewModel(doc)),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export type ContentPieceDetailPageData = {
  piece: ContentPieceViewModel & {
    description: string | null
    transcript: string | null
    institution: string | null
    sourceUrl: string | null
    /** Raw `yyyy-mm-dd` for the form's date input; null when unset. */
    pieceDate: string | null
    municipalityId: number | null
    curatedFields: string[]
  }
}

/**
 * C211 — one piece of the Central, any status: the ficha is where the catalogue
 * is edited and the kill switch lives, so a failed or unpublished piece stays
 * reachable (and its file servable) while it is not public.
 */
export const loadContentPieceDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  contentPieceId: number,
): Promise<ContentPieceDetailPageData> => {
  const result = await payload.find({
    collection: 'contentPiece',
    where: { id: { equals: contentPieceId } },
    depth: 0,
    limit: 1,
    pagination: false,
    select: contentPieceDetailSelect,
    user,
    overrideAccess: false,
  })

  const piece = result.docs[0]
  if (!piece) throw new ContentPieceNotFoundError()

  const viewModel = toContentPieceViewModel(piece)
  return {
    piece: {
      ...viewModel,
      description: piece.description?.trim() || null,
      transcript: piece.transcript?.trim() || null,
      institution: piece.institution?.trim() || null,
      sourceUrl: piece.sourceUrl?.trim() || null,
      pieceDate: piece.pieceDate?.slice(0, 10) || null,
      municipalityId:
        typeof piece.municipality === 'number'
          ? piece.municipality
          : (piece.municipality?.id ?? null),
      curatedFields: piece.curatedFields ?? [],
    },
  }
}
