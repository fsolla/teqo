import type { Payload, Where } from 'payload'

import type { CampaignUser, Leadership } from '@/payload-types'
import {
  leadershipLeaderSelect,
  leadershipStaffListSelect,
  leadershipStaffSelect,
  toSelectedLeadershipViewModel,
  toLeadershipPageData,
  type LeadershipStaffViewModel,
  type SelfLeadershipPageData,
  type StaffLeadershipPageData,
} from '@/utilities/leadershipViewModels'
import type { LeadershipFilterState } from '@/utilities/leadershipUi'
import { getLeadershipConsent } from '@/utilities/campaignConsent'
import type { AccessibleNucleusContext } from '@/utilities/nucleusPageData'

export const leadershipPageSize = 25

type GetNucleusLeadershipPageData = {
  (
    payload: Payload,
    user: CampaignUser & { role: 'lideranca' },
    context: AccessibleNucleusContext,
    state?: LeadershipFilterState,
  ): Promise<SelfLeadershipPageData>
  (
    payload: Payload,
    user: CampaignUser & { role: 'geral' | 'coordenador' },
    context: AccessibleNucleusContext,
    state?: LeadershipFilterState,
  ): Promise<StaffLeadershipPageData>
  (
    payload: Payload,
    user: CampaignUser,
    context: AccessibleNucleusContext,
    state?: LeadershipFilterState,
  ): Promise<StaffLeadershipPageData | SelfLeadershipPageData>
}

export const getNucleusLeadershipPageData = (async (
  payload: Payload,
  user: CampaignUser,
  context: AccessibleNucleusContext,
  state: LeadershipFilterState = {},
): Promise<StaffLeadershipPageData | SelfLeadershipPageData> => {
  const nucleusId = context.id
  const filters: Where[] = [{ nucleus: { equals: nucleusId } }]
  if (user.role !== 'lideranca') {
    if (state.status) filters.push({ supportStatus: { equals: state.status } })
    if (state.sector) filters.push({ sector: { equals: state.sector } })
    if (state.q) {
      filters.push({
        or: [
          { 'contact.name': { contains: state.q } },
          { 'contact.phone': { contains: state.q.replace(/\D/g, '') || state.q } },
        ],
      })
    }
  }
  const [result, currentConsent] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: filters.length === 1 ? filters[0] : { and: filters },
      depth: 1,
      limit: user.role === 'lideranca' ? 1 : leadershipPageSize,
      page: user.role === 'lideranca' ? 1 : (state.page ?? 1),
      sort: 'contact.name',
      select: user.role === 'lideranca' ? leadershipLeaderSelect : leadershipStaffListSelect,
      user,
      overrideAccess: false,
    }),
    getLeadershipConsent(payload),
  ])

  const leaderships = (result.docs as Leadership[]).sort((left, right) => {
    const leftName = typeof left.contact === 'object' ? left.contact.name : ''
    const rightName = typeof right.contact === 'object' ? right.contact.name : ''
    return leftName.localeCompare(rightName, 'pt-BR')
  })

  if (user.role === 'lideranca') {
    return toLeadershipPageData(
      leaderships,
      'lideranca',
      {
        page: 1,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
      },
      currentConsent ?? undefined,
    )
  }

  return toLeadershipPageData(
    leaderships,
    user.role,
    {
      page: result.page ?? state.page ?? 1,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
    },
    currentConsent ?? undefined,
  )
}) as GetNucleusLeadershipPageData

export const getSelectedNucleusLeadershipPageData = async (
  payload: Payload,
  user: CampaignUser,
  context: AccessibleNucleusContext,
  leadershipId: number,
): Promise<LeadershipStaffViewModel | null> => {
  if (user.role === 'lideranca') return null

  const [result, currentConsent] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: {
        and: [{ id: { equals: leadershipId } }, { nucleus: { equals: context.id } }],
      },
      depth: 1,
      limit: 1,
      select: leadershipStaffSelect,
      user,
      overrideAccess: false,
    }),
    getLeadershipConsent(payload),
  ])
  const leadership = result.docs[0] as Leadership | undefined
  return leadership ? toSelectedLeadershipViewModel(leadership, currentConsent ?? undefined) : null
}
