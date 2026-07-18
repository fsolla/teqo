import type { Payload, Where } from 'payload'

import type { CampaignUser } from '@/payload-types'

export const eligibleNucleusCoordinatorWhere: Where = {
  or: [{ role: { equals: 'geral' } }, { role: { equals: 'coordenador' } }],
}

export type NucleusCoordinatorOption = Pick<CampaignUser, 'id' | 'name'> & {
  isCurrent: boolean
}

export type NucleusCoordinatorSummary = Pick<CampaignUser, 'id' | 'name'> & {
  phone: string | null
}

export const loadCoordinatorSummaries = async (
  payload: Payload,
  user: CampaignUser,
  coordinatorIds: number[],
): Promise<NucleusCoordinatorSummary[]> => {
  if (coordinatorIds.length === 0) return []

  const result = await payload.find({
    collection: 'campaignUser',
    where: {
      and: [{ id: { in: coordinatorIds } }, eligibleNucleusCoordinatorWhere],
    },
    depth: 0,
    pagination: false,
    select: { name: true, phone: true },
    user,
    overrideAccess: false,
  })
  const coordinatorById = new Map(
    result.docs.map(({ id, name, phone }) => [id, { id, name, phone: phone ?? null }]),
  )

  return coordinatorIds.flatMap((id) => {
    const coordinator = coordinatorById.get(id)
    return coordinator ? [coordinator] : []
  })
}

export const getEligibleNucleusCoordinatorOptions = async (
  payload: Payload,
  user: CampaignUser,
): Promise<NucleusCoordinatorOption[]> => {
  const result = await payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    sort: 'name',
    where: eligibleNucleusCoordinatorWhere,
    select: { name: true },
    user,
    overrideAccess: false,
  })

  return result.docs
    .map(({ id, name }) => ({
      id,
      name,
      isCurrent: id === user.id,
    }))
    .sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent))
}
