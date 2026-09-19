import 'server-only'

import type { Payload } from 'payload'

import {
  toReelDetailViewModel,
  toReelLibraryItemViewModel,
  type ReelDetailViewModel,
  type ReelLibraryItemViewModel,
} from '@/lib/reel'
import { REEL_NOT_FOUND_MESSAGE } from '@/lib/schemas/reel'
import type { CampaignUser } from '@/payload-types'
import { type RawSearchParams } from '@/utilities/campaignListUrl'
import { createEntityNotFoundError } from '@/utilities/entityNotFound'
import {
  parseReelListParams,
  reelPageSize,
  resolveReelListUrl,
  type ReelListState,
} from '@/utilities/reels/reelListUrl'

/**
 * Lean `select` of the library grid: only the fields the card view model
 * renders. Payload does not reflect `select` in the result type, so the int
 * test is the guard.
 */
const reelListSelect = {
  title: true,
  feature: true,
  status: true,
  publishedAt: true,
  cover: true,
} as const

/** Everything the detail view model reads, including the optional artifacts. */
const reelDetailSelect = {
  title: true,
  feature: true,
  status: true,
  publishedAt: true,
  transcript: true,
  video: true,
  videoWithAudio: true,
  narrationAudio: true,
  captions: true,
  cover: true,
} as const

export const ReelNotFoundError = createEntityNotFoundError('Reel', REEL_NOT_FOUND_MESSAGE)

export type ReelLibraryPageData = {
  rows: ReelLibraryItemViewModel[]
  state: ReelListState
  redirectHref?: string
  totalDocs: number
  totalPages: number
}

/**
 * C194 — the library list: published reels only (the kill switch takes the row
 * off the list without deleting it), newest publication first. Access is the
 * collection's own `canReadReel` (communicator/coordinator/candidate).
 */
export const loadReelLibraryPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<RawSearchParams> | RawSearchParams,
): Promise<ReelLibraryPageData> => {
  const rawSearchParams = await searchParams
  const state = parseReelListParams(rawSearchParams)

  const result = await payload.find({
    collection: 'reel',
    depth: 1,
    limit: reelPageSize,
    page: state.page,
    sort: '-publishedAt',
    where: { status: { equals: 'published' } },
    select: reelListSelect,
    user,
    overrideAccess: false,
  })

  const resolvedUrl = resolveReelListUrl(rawSearchParams, result.totalPages)

  return {
    rows: result.docs.map((reel) => toReelLibraryItemViewModel(reel)),
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

/**
 * C194 — one reel of the library, any status: the detail is where the kill
 * switch is reversed, so an unpublished reel stays reachable while its media
 * does not (C193 decision B withholds the player and the downloads).
 */
export const loadReelDetailPageData = async (
  payload: Payload,
  user: CampaignUser,
  reelId: number,
): Promise<ReelDetailViewModel> => {
  const result = await payload.find({
    collection: 'reel',
    where: { id: { equals: reelId } },
    depth: 1,
    limit: 1,
    pagination: false,
    select: reelDetailSelect,
    user,
    overrideAccess: false,
  })

  const reel = result.docs[0]
  if (!reel) throw new ReelNotFoundError()

  return toReelDetailViewModel(reel)
}
