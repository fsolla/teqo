import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { loadCoordinatorSummaries } from '@/utilities/nucleusCoordinatorOptions'
import type { AccessibleNucleusContext } from '@/utilities/nucleusPageData'
import { requireRelationshipId } from '@/utilities/relationship'

export type AssignedCoordinatorViewModel = {
  id: number
  name: string
  phone: string | null
}

type NucleusCoordinatorAssignmentBase = {
  coordinators: AssignedCoordinatorViewModel[]
}

export type GeneralNucleusCoordinatorAssignmentPageData = NucleusCoordinatorAssignmentBase & {
  canManage: true
}

export type ScopedNucleusCoordinatorAssignmentPageData = NucleusCoordinatorAssignmentBase & {
  canManage: false
}

export type NucleusCoordinatorAssignmentPageData =
  | GeneralNucleusCoordinatorAssignmentPageData
  | ScopedNucleusCoordinatorAssignmentPageData

export const getNucleusCoordinatorAssignmentPageData = async (
  payload: Payload,
  user: CampaignUser,
  context: AccessibleNucleusContext,
): Promise<NucleusCoordinatorAssignmentPageData> => {
  const nucleus = context.document

  const coordinatorIds = (nucleus.coordinators ?? []).map((coordinator) =>
    requireRelationshipId(coordinator),
  )
  const coordinators = await loadCoordinatorSummaries(payload, user, coordinatorIds)

  if (user.role !== 'geral') return { canManage: false, coordinators }

  return {
    canManage: true,
    coordinators,
  }
}
