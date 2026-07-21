import type { Payload } from 'payload'

import type { PlazaUpdateKind } from '@/lib/schemas/plazaUpdate'
import { plazaUpdateKinds } from '@/lib/schemas/plazaUpdate'
import type { CampaignUser, PlazaUpdate } from '@/payload-types'
import { relationshipId } from '@/utilities/relationship'

export const plazaUpdatesPageSize = 10

export type PlazaUpdateViewModel = {
  id: number
  kind: PlazaUpdateKind
  authorName: string
  createdAt: string
  worked: string | null
  failed: string | null
  needs: string | null
  body: string | null
  activeVolunteers: number | null
  newSupports: number | null
}

export type PlazaUpdateFeedState = {
  kind?: PlazaUpdateKind
  page: number
}

export const parsePlazaUpdateFeedParams = (
  searchParams: Record<string, string | string[] | undefined>,
): PlazaUpdateFeedState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawKind = first(searchParams.updateKind)
  const rawPage = first(searchParams.updatePage)
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1

  return {
    ...(plazaUpdateKinds.includes(rawKind as PlazaUpdateKind)
      ? { kind: rawKind as PlazaUpdateKind }
      : {}),
    page,
  }
}

export const loadPlazaUpdatesFeed = async (
  payload: Payload,
  user: CampaignUser,
  plazaID: number,
  state: PlazaUpdateFeedState,
): Promise<{
  updates: PlazaUpdateViewModel[]
  totalDocs: number
  totalPages: number
  page: number
}> => {
  const result = await payload.find({
    collection: 'plazaUpdate',
    where: {
      and: [
        { plaza: { equals: plazaID } },
        ...(state.kind ? [{ kind: { equals: state.kind } }] : []),
      ],
    },
    depth: 0,
    limit: plazaUpdatesPageSize,
    page: state.page,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  const authorIDs = [
    ...new Set(
      result.docs
        .map((update) => relationshipId((update as PlazaUpdate).author))
        .filter((id): id is number => id !== null),
    ),
  ]
  // Intentional admin bypass: resolves author display names for rows the
  // actor already passed row-level access on.
  const authors = authorIDs.length
    ? await payload.find({
        collection: 'campaignUser',
        where: { id: { in: authorIDs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { name: true },
        overrideAccess: true,
      })
    : { docs: [] }
  const authorNameById = new Map(authors.docs.map((author) => [author.id, author.name]))

  return {
    updates: result.docs.map((update) => {
      const doc = update as PlazaUpdate
      return {
        id: doc.id,
        kind: doc.kind as PlazaUpdateKind,
        authorName: authorNameById.get(relationshipId(doc.author) ?? -1) ?? 'Usuário',
        createdAt: doc.createdAt,
        worked: doc.worked ?? null,
        failed: doc.failed ?? null,
        needs: doc.needs ?? null,
        body: doc.body ?? null,
        activeVolunteers: doc.activeVolunteers ?? null,
        newSupports: doc.newSupports ?? null,
      }
    }),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? state.page,
  }
}

export const loadPlazaUpdatesPreview = async (
  payload: Payload,
  user: CampaignUser,
  plazaID: number,
): Promise<PlazaUpdateViewModel[]> =>
  (await loadPlazaUpdatesFeed(payload, user, plazaID, { page: 1 })).updates.slice(0, 3)
