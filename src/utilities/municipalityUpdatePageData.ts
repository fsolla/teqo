import 'server-only'

import type { Payload } from 'payload'

import type {
  MunicipalitySignalType,
  MunicipalityUpdateKind,
} from '@/lib/schemas/municipalityUpdate'
import { municipalityUpdateKinds } from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser, MunicipalityUpdate } from '@/payload-types'
import { relationshipId } from '@/utilities/relationship'

export const municipalityUpdatesPageSize = 10

export type MunicipalityUpdateViewModel = {
  id: number
  kind: MunicipalityUpdateKind
  authorName: string
  createdAt: string
  worked: string | null
  failed: string | null
  needs: string | null
  body: string | null
  activeVolunteers: number | null
  newSupports: number | null
  signalType: MunicipalitySignalType | null
  signalSource: string | null
  triangulated: boolean
}

export type MunicipalityUpdateFeedState = {
  kind?: MunicipalityUpdateKind
  page: number
}

export const parseMunicipalityUpdateFeedParams = (
  searchParams: Record<string, string | string[] | undefined>,
): MunicipalityUpdateFeedState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawKind = first(searchParams.updateKind)
  const rawPage = first(searchParams.updatePage)
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1

  return {
    ...(municipalityUpdateKinds.includes(rawKind as MunicipalityUpdateKind)
      ? { kind: rawKind as MunicipalityUpdateKind }
      : {}),
    page,
  }
}

export const loadMunicipalityUpdatesFeed = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
  state: MunicipalityUpdateFeedState,
): Promise<{
  updates: MunicipalityUpdateViewModel[]
  totalDocs: number
  totalPages: number
  page: number
}> => {
  const result = await payload.find({
    collection: 'municipalityUpdate',
    where: {
      and: [
        { municipality: { equals: municipalityID } },
        ...(state.kind ? [{ kind: { equals: state.kind } }] : []),
      ],
    },
    depth: 0,
    limit: municipalityUpdatesPageSize,
    page: state.page,
    sort: '-createdAt',
    user,
    overrideAccess: false,
  })

  const authorIDs = [
    ...new Set(
      result.docs
        .map((update) => relationshipId((update as MunicipalityUpdate).author))
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
      const doc = update as MunicipalityUpdate
      return {
        id: doc.id,
        kind: doc.kind as MunicipalityUpdateKind,
        authorName: authorNameById.get(relationshipId(doc.author) ?? -1) ?? 'Usuário',
        createdAt: doc.createdAt,
        worked: doc.worked ?? null,
        failed: doc.failed ?? null,
        needs: doc.needs ?? null,
        body: doc.body ?? null,
        activeVolunteers: doc.activeVolunteers ?? null,
        newSupports: doc.newSupports ?? null,
        signalType: doc.signalType ?? null,
        signalSource: doc.signalSource ?? null,
        triangulated: Boolean(doc.triangulated),
      }
    }),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    page: result.page ?? state.page,
  }
}

export const loadMunicipalityUpdatesPreview = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<MunicipalityUpdateViewModel[]> =>
  (await loadMunicipalityUpdatesFeed(payload, user, municipalityID, { page: 1 })).updates.slice(
    0,
    3,
  )
