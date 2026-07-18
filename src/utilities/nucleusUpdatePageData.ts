import type { Payload, Where } from 'payload'

import type { CampaignUser, NucleusUpdate } from '@/payload-types'
import {
  nucleusUpdateSelect,
  nucleusUpdatePageSize,
  toNucleusUpdateViewModel,
  type NucleusUpdateListState,
  type NucleusUpdateAuthorViewModel,
  type NucleusUpdateViewModel,
} from '@/utilities/nucleusUpdateUi'
import type { AccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { requireRelationshipId } from '@/utilities/relationship'

type RawNucleusUpdate = Pick<
  NucleusUpdate,
  | 'id'
  | 'author'
  | 'kind'
  | 'worked'
  | 'failed'
  | 'needs'
  | 'activeVolunteers'
  | 'newSupports'
  | 'body'
  | 'createdAt'
>

export type NucleusUpdatesPageData = {
  kind?: NucleusUpdate['kind']
  page: number
  totalDocs: number
  totalPages: number
  updates: NucleusUpdateViewModel[]
}

export const getNucleusUpdatesPageData = async (
  payload: Payload,
  user: CampaignUser,
  context: AccessibleNucleusContext,
  state: NucleusUpdateListState,
): Promise<NucleusUpdatesPageData> => {
  const nucleusId = context.id

  const where: Where = state.kind
    ? {
        and: [{ nucleus: { equals: nucleusId } }, { kind: { equals: state.kind } }],
      }
    : { nucleus: { equals: nucleusId } }
  const result = await payload.find({
    collection: 'nucleusUpdate',
    where,
    depth: 0,
    limit: nucleusUpdatePageSize,
    page: state.page,
    sort: '-createdAt',
    select: nucleusUpdateSelect,
    user,
    overrideAccess: false,
  })
  const updates = result.docs as unknown as RawNucleusUpdate[]
  const authorIds = [...new Set(updates.map(({ author }) => requireRelationshipId(author)))]

  const authors =
    user.role === 'lideranca'
      ? [user]
      : authorIds.length === 0
        ? []
        : (
            await payload.find({
              collection: 'campaignUser',
              where: { id: { in: authorIds } },
              depth: 0,
              pagination: false,
              select: { name: true, role: true },
              user,
              overrideAccess: false,
            })
          ).docs
  const authorsById = new Map<number, NucleusUpdateAuthorViewModel>(
    authors.map((author) => [
      author.id,
      {
        id: author.id,
        name: author.name,
        role: author.role,
      },
    ]),
  )

  const toViewModels = (records: RawNucleusUpdate[]): NucleusUpdateViewModel[] =>
    records.flatMap((update) => {
      const author = authorsById.get(requireRelationshipId(update.author))
      return author ? [toNucleusUpdateViewModel(update, author)] : []
    })

  return {
    ...(state.kind ? { kind: state.kind } : {}),
    page: result.page ?? state.page,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    updates: toViewModels(updates),
  }
}

export const getNucleusUpdatesPreviewData = async (
  payload: Payload,
  user: CampaignUser,
  context: AccessibleNucleusContext,
): Promise<NucleusUpdateViewModel[]> => {
  const result = await payload.find({
    collection: 'nucleusUpdate',
    where: { nucleus: { equals: context.id } },
    depth: 0,
    limit: 3,
    page: 1,
    sort: '-createdAt',
    select: nucleusUpdateSelect,
    user,
    overrideAccess: false,
  })
  const updates = result.docs as unknown as RawNucleusUpdate[]
  const authorIds = [...new Set(updates.map(({ author }) => requireRelationshipId(author)))]
  const authors =
    user.role === 'lideranca'
      ? [user]
      : authorIds.length === 0
        ? []
        : (
            await payload.find({
              collection: 'campaignUser',
              where: { id: { in: authorIds } },
              depth: 0,
              pagination: false,
              select: { name: true, role: true },
              user,
              overrideAccess: false,
            })
          ).docs
  const authorsById = new Map<number, NucleusUpdateAuthorViewModel>(
    authors.map((author) => [
      author.id,
      {
        id: author.id,
        name: author.name,
        role: author.role,
      },
    ]),
  )

  return updates.flatMap((update) => {
    const author = authorsById.get(requireRelationshipId(update.author))
    return author ? [toNucleusUpdateViewModel(update, author)] : []
  })
}
