import type { Payload } from 'payload'

import type { RelationOption } from '@/components/campaign/RelationMultiSelect'
import type { CampaignUser, Consent, Supporter } from '@/payload-types'
import { getAdvisorPlazaIds } from '@/utilities/campaignAccess'
import {
  getSupporterRegistrationConsent,
  getSupporterVoteIntentionConsent,
} from '@/utilities/campaignConsent'
import { loadPlazaOptions } from '@/utilities/campaignRelationOptions'
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
  plaza: true,
} as const

const supporterDetailSelect = {
  voteIntention: true,
  source: true,
  consentedAt: true,
  voteIntentionConsentedAt: true,
  createdAt: true,
  contact: true,
  plaza: true,
  createdBy: true,
} as const

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
  advisorPlazaIds?: number[],
): Promise<SupporterListOverviewViewModel | null> =>
  computeSupporterListOverviewAggregate(payload, user, state, total, advisorPlazaIds)

export type SupportersPageData = {
  result: Awaited<ReturnType<typeof loadSupporterListPageData>>['result']
  state: SupporterListState
  redirectHref?: string
  plazaOptions: RelationOption[]
  overview: SupporterListOverviewViewModel | null
  advisorPlazaIds?: number[]
}

export const loadSupportersPageData = async (
  payload: Payload,
  user: CampaignUser,
  searchParams: Promise<SupporterListSearchParams> | SupporterListSearchParams,
): Promise<SupportersPageData> => {
  const advisorPromise =
    user.role === 'advisor' ? getAdvisorPlazaIds(payload, user.id) : Promise.resolve(undefined)

  const [{ result, state, redirectHref }, advisorPlazaIds] = await Promise.all([
    loadSupporterListPageData(payload, user, searchParams),
    advisorPromise,
  ])

  const [plazaOptions, overview] = await Promise.all([
    loadPlazaOptions(payload, user),
    loadSupporterListOverviewData(payload, user, state, result.totalDocs, advisorPlazaIds),
  ])

  return {
    result,
    state,
    redirectHref,
    plazaOptions,
    overview,
    advisorPlazaIds,
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
  plazaOptions: RelationOption[]
  registrationConsentConfigured: boolean
  voteIntentionConsentConfigured: boolean
  requirePlaza: boolean
}

export const loadSupporterCreatePageData = async (
  payload: Payload,
  user: CampaignUser,
): Promise<SupporterCreatePageData> => {
  const [plazaOptions, registrationConsent, voteIntentionConsent] = await Promise.all([
    loadPlazaOptions(payload, user),
    getSupporterRegistrationConsent(payload),
    getSupporterVoteIntentionConsent(payload),
  ])

  return {
    plazaOptions,
    registrationConsentConfigured: Boolean(registrationConsent),
    voteIntentionConsentConfigured: Boolean(voteIntentionConsent),
    requirePlaza: user.role === 'advisor',
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
