import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import {
  municipalityUpdatePolarities,
  type MunicipalityUpdatePolarity,
} from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser, MunicipalityUpdate } from '@/payload-types'
import { loadCampaignUserNamesByIds } from '@/utilities/loadNamesByIds'

export const municipalityUpdatesPageSize = 10

export type MunicipalityUpdateViewModel = {
  id: number
  authorName: string
  createdAt: string
  body: string | null
  polarity: MunicipalityUpdatePolarity
  urgent: boolean
  activeVolunteers: number | null
  newSupports: number | null
  adversarySignal: boolean
}

export type MunicipalityUpdateFeedState = {
  page: number
}

export const parseMunicipalityUpdateFeedParams = (
  searchParams: Record<string, string | string[] | undefined>,
): MunicipalityUpdateFeedState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const rawPage = first(searchParams.updatePage)
  const page = rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1

  return { page }
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
      municipality: { equals: municipalityID },
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
  const authorNameById = await loadCampaignUserNamesByIds(payload, authorIDs)

  return {
    updates: result.docs.map((update) => {
      const doc = update as MunicipalityUpdate
      const polarity = doc.polarity as MunicipalityUpdatePolarity | undefined
      return {
        id: doc.id,
        authorName: authorNameById.get(relationshipId(doc.author) ?? -1) ?? 'Usuário',
        createdAt: doc.createdAt,
        body: doc.body ?? null,
        polarity: polarity && municipalityUpdatePolarities.includes(polarity) ? polarity : 'neutra',
        urgent: Boolean(doc.urgent),
        activeVolunteers: doc.activeVolunteers ?? null,
        newSupports: doc.newSupports ?? null,
        adversarySignal: Boolean(doc.adversarySignal),
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
