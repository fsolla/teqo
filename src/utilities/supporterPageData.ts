import type { Payload } from 'payload'

import type { CampaignUser, Consent, ElectoralNucleus, Supporter } from '@/payload-types'
import { getCoordinatorNucleusIds } from '@/utilities/campaignAccess'
import {
  getSupporterRegistrationConsent,
  getSupporterVoteIntentionConsent,
} from '@/utilities/campaignConsent'
import { computeSupporterListOverviewAggregate } from '@/utilities/supporterListOverviewAggregate'
import {
  buildSupporterListWhere,
  resolveSupporterListUrl,
  supporterPageSize,
  type SupporterListState,
} from '@/utilities/supporterUi'
import {
  toSupporterDetailViewModel,
  type SupporterDetailViewModel,
  type SupporterListOverviewViewModel,
  type SupporterNucleusOption,
} from '@/utilities/supporterViewModels'

type SupporterListSearchParams = Record<string, string | string[] | undefined>

export class SupporterNotFoundError extends Error {
  override name = 'SupporterNotFoundError'

  constructor() {
    super('Apoiador não encontrado.')
  }
}

const supporterListSelect = {
  voteIntention: true,
  contact: true,
  nucleus: true,
} as const

const supporterDetailSelect = {
  voteIntention: true,
  source: true,
  consentedAt: true,
  voteIntentionConsentedAt: true,
  createdAt: true,
  contact: true,
  nucleus: true,
  createdBy: true,
} as const

const nucleusOptionsSelect = {
  name: true,
  slug: true,
} as const

export const loadAccessibleNucleusOptions = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  coordinatorNucleusIds?: number[],
): Promise<SupporterNucleusOption[]> => {
  let result: { docs: ElectoralNucleus[] }

  if (user.role === 'coordenador' && coordinatorNucleusIds !== undefined) {
    if (coordinatorNucleusIds.length === 0) return []

    result = await payload.find({
      collection: 'electoralNucleus',
      where: {
        and: [{ status: { equals: 'ativo' } }, { id: { in: coordinatorNucleusIds } }],
      },
      depth: 0,
      pagination: false,
      sort: 'name',
      select: nucleusOptionsSelect,
      overrideAccess: true,
    })
  } else {
    result = await payload.find({
      collection: 'electoralNucleus',
      where: { status: { equals: 'ativo' } },
      depth: 0,
      pagination: false,
      sort: 'name',
      select: nucleusOptionsSelect,
      user,
      overrideAccess: false,
    })
  }

  return result.docs.map((nucleus) => {
    const doc = nucleus as ElectoralNucleus
    return { id: doc.id, name: doc.name, slug: doc.slug }
  })
}

export const loadSupporterListPageData = async (
  payload: Pick<Payload, 'find' | 'count'>,
  user: CampaignUser,
  searchParams: Promise<SupporterListSearchParams> | SupporterListSearchParams,
) => {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveSupporterListUrl(rawSearchParams)
  const where = buildSupporterListWhere(canonicalUrl.state)

  const result = await payload.find({
    collection: 'supporter',
    depth: 1,
    limit: supporterPageSize,
    page: canonicalUrl.state.page,
    sort: '-updatedAt',
    where,
    select: supporterListSelect,
    user,
    overrideAccess: false,
  })

  const resolvedUrl = resolveSupporterListUrl(rawSearchParams, result.totalPages)

  return {
    result,
    state: resolvedUrl.state,
    redirectHref: resolvedUrl.redirectHref ?? canonicalUrl.redirectHref,
  }
}

export const loadSupporterListOverviewData = async (
  payload: Payload,
  user: CampaignUser,
  state: SupporterListState,
  total: number,
  coordinatorNucleusIds?: number[],
): Promise<SupporterListOverviewViewModel | null> =>
  computeSupporterListOverviewAggregate(payload, user, state, total, coordinatorNucleusIds)

export type SupportersPageData = {
  result: Awaited<ReturnType<typeof loadSupporterListPageData>>['result']
  state: SupporterListState
  redirectHref?: string
  nucleusOptions: SupporterNucleusOption[]
  overview: SupporterListOverviewViewModel | null
  coordinatorNucleusIds?: number[]
}

export const loadSupportersPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SupporterListSearchParams> | SupporterListSearchParams,
): Promise<SupportersPageData> => {
  const coordinatorPromise =
    user.role === 'coordenador'
      ? getCoordinatorNucleusIds(payload, user.id)
      : Promise.resolve(undefined)

  const [{ result, state, redirectHref }, coordinatorNucleusIds] = await Promise.all([
    loadSupporterListPageData(payload, user, searchParams),
    coordinatorPromise,
  ])

  const [nucleusOptions, overview] = await Promise.all([
    loadAccessibleNucleusOptions(payload, user, coordinatorNucleusIds),
    loadSupporterListOverviewData(
      payload,
      user,
      state,
      result.totalDocs,
      coordinatorNucleusIds,
    ),
  ])

  return {
    result,
    state,
    redirectHref,
    nucleusOptions,
    overview,
    coordinatorNucleusIds,
  }
}

export const loadSupporterDetailPageData = async (
  payload: Pick<Payload, 'find'>,
  user: CampaignUser,
  supporterId: number,
): Promise<SupporterDetailViewModel> => {
  const result = await payload.find({
    collection: 'supporter',
    where: { id: { equals: supporterId } },
    depth: 1,
    limit: 1,
    pagination: false,
    select: supporterDetailSelect,
    user,
    overrideAccess: false,
  })
  const supporter = result.docs[0]
  if (!supporter) throw new SupporterNotFoundError()

  return toSupporterDetailViewModel(supporter as Supporter)
}

export type SupporterCreatePageData = {
  nucleusOptions: SupporterNucleusOption[]
  registrationConsentConfigured: boolean
  voteIntentionConsentConfigured: boolean
  requireNucleus: boolean
}

export const loadSupporterCreatePageData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<SupporterCreatePageData> => {
  const [nucleusOptions, registrationConsent, voteIntentionConsent] = await Promise.all([
    loadAccessibleNucleusOptions(payload, user),
    getSupporterRegistrationConsent(payload),
    getSupporterVoteIntentionConsent(payload),
  ])

  return {
    nucleusOptions,
    registrationConsentConfigured: Boolean(registrationConsent),
    voteIntentionConsentConfigured: Boolean(voteIntentionConsent),
    requireNucleus: user.role === 'coordenador',
  }
}

export type SupporterDetailConsentData = {
  registrationConsent: Consent['text'] | null
  voteIntentionConsent: Consent['text'] | null
}

export const loadSupporterDetailConsentData = async (
  payload: Payload,
): Promise<SupporterDetailConsentData> => {
  const [registrationConsent, voteIntentionConsent] = await Promise.all([
    getSupporterRegistrationConsent(payload),
    getSupporterVoteIntentionConsent(payload),
  ])

  return {
    registrationConsent: registrationConsent?.text ?? null,
    voteIntentionConsent: voteIntentionConsent?.text ?? null,
  }
}
