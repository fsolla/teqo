import type { Payload } from 'payload'

import type { CampaignUser, ElectoralNucleus } from '@/payload-types'
import type { NucleusDetailTab } from '@/utilities/nucleusDetailTabUi'
import {
  buildNucleusListWhere,
  nucleusPageSize,
  parseNucleusListParams,
} from '@/utilities/nucleusUi'
import {
  nucleusFormSelect,
  nucleusLeadershipDetailSelect,
  nucleusListSelect,
  nucleusStaffDetailSelect,
  toNucleusDetailViewModel,
  toNucleusFormViewModel,
} from '@/utilities/nucleusViewModels'

type NucleusListSearchParams = Record<string, string | string[] | undefined>

export class NucleusNotFoundError extends Error {
  override name = 'NucleusNotFoundError'

  constructor() {
    super('Núcleo não encontrado.')
  }
}

export type AccessibleNucleusContext = {
  id: number
  slug: string
  document: ElectoralNucleus
}

const nucleusContextSelect = {
  name: true,
  slug: true,
  status: true,
  region: true,
  city: true,
  neighborhood: true,
  locality: true,
  organizationKind: true,
  organizationLabel: true,
  tseZones: { zoneNumber: true },
  confirmedVoteEstimate: true,
  confirmedVoteEstimateAt: true,
  confirmedVoteEstimateBy: true,
  proposedVoteEstimate: true,
  proposedVoteEstimateAt: true,
  proposedVoteEstimateBy: true,
  proposedVoteEstimateVersion: true,
  coordinators: true,
  updatedAt: true,
} as const

const nucleusLeadershipContextSelect = {
  ...nucleusLeadershipDetailSelect,
  coordinators: true,
  updatedAt: true,
} as const

const getNucleusStaffContextSelect = (activeTab: NucleusDetailTab) => {
  if (activeTab === 'overview') {
    return {
      ...nucleusContextSelect,
      strengths: nucleusStaffDetailSelect.strengths,
      risks: nucleusStaffDetailSelect.risks,
      ticketAlliance: nucleusStaffDetailSelect.ticketAlliance,
      territoryNotes: nucleusStaffDetailSelect.territoryNotes,
      voterProfiles: nucleusStaffDetailSelect.voterProfiles,
      primaryContact: nucleusStaffDetailSelect.primaryContact,
    } as const
  }
  if (activeTab === 'territory') {
    return {
      ...nucleusContextSelect,
      territoryNotes: nucleusStaffDetailSelect.territoryNotes,
    } as const
  }
  if (activeTab === 'electorate') {
    return {
      ...nucleusContextSelect,
      voterProfiles: nucleusStaffDetailSelect.voterProfiles,
    } as const
  }
  if (activeTab === 'leaderships') {
    return {
      ...nucleusContextSelect,
      primaryContact: nucleusStaffDetailSelect.primaryContact,
    } as const
  }
  return nucleusContextSelect
}

export const loadNucleusListPageData = async (
  payload: Pick<Payload, 'find' | 'count'>,
  user: CampaignUser,
  searchParams: Promise<NucleusListSearchParams> | NucleusListSearchParams,
) => {
  const state = parseNucleusListParams(await searchParams)
  const [result, scope] = await Promise.all([
    payload.find({
      collection: 'electoralNucleus',
      depth: 1,
      limit: nucleusPageSize,
      page: state.page,
      sort: 'name',
      where: buildNucleusListWhere(state),
      select: nucleusListSelect,
      user,
      overrideAccess: false,
    }),
    payload.count({
      collection: 'electoralNucleus',
      where: { status: { equals: 'ativo' } },
      user,
      overrideAccess: false,
    }),
  ])

  return { result, scope, state }
}

export const resolveAccessibleNucleusContext = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  nucleusSlug: string,
  activeTab: NucleusDetailTab = 'overview',
): Promise<AccessibleNucleusContext> => {
  const result = await payload.find({
    collection: 'electoralNucleus',
    where: { slug: { equals: nucleusSlug } },
    depth: 1,
    limit: 1,
    pagination: false,
    select:
      user.role === 'lideranca'
        ? nucleusLeadershipContextSelect
        : getNucleusStaffContextSelect(activeTab),
    user,
    overrideAccess: false,
  })
  const nucleus = result.docs[0]
  if (!nucleus) throw new NucleusNotFoundError()

  return {
    id: nucleus.id,
    slug: nucleus.slug,
    document: nucleus as ElectoralNucleus,
  }
}

export const getNucleusDetailPageData = (
  context: AccessibleNucleusContext,
  user: CampaignUser,
) => toNucleusDetailViewModel(context.document, user.role)

export const getNucleusEditPageData = async (
  payload: Payload,
  user: CampaignUser,
  nucleusSlug: string,
) => {
  const result = await payload.find({
    collection: 'electoralNucleus',
    where: { slug: { equals: nucleusSlug } },
    depth: 1,
    limit: 1,
    pagination: false,
    select: nucleusFormSelect,
    user,
    overrideAccess: false,
  })
  const nucleus = result.docs[0]
  if (!nucleus) throw new Error('Núcleo não encontrado.')
  return toNucleusFormViewModel(nucleus as ElectoralNucleus)
}
