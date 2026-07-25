import 'server-only'

import type { Payload } from 'payload'

import {
  demographicsForCode,
  type MunicipalityDemographics,
} from '@/lib/bahiaMunicipalityDemographics'
import type { ActionPlan, CampaignUser } from '@/payload-types'
import { buildActionPlanListWhere } from '@/utilities/actionPlanUi'
import {
  actionPlanListSelect,
  toActionPlanListViewModel,
  type ActionPlanListViewModel,
} from '@/utilities/actionPlanViewModels'
import {
  loadFreshestMunicipalityLeaderships,
  type LeadershipRowViewModel,
} from '@/utilities/leadershipData'
import { municipalityElectionGeographyForSlug } from '@/utilities/municipalityElectionGeography'
import {
  loadMunicipalityElectoralBaseline,
  type MunicipalityElectoralBaseline,
} from '@/utilities/municipalityElectoralBaseline'
import {
  loadMunicipalityGoalAccount,
  type MunicipalityGoalAccount,
} from '@/utilities/municipalityGoalAccount'
import {
  loadMunicipalityUpdatesFeed,
  type MunicipalityUpdateViewModel,
} from '@/utilities/municipalityUpdatePageData'
import type { MunicipalityDetailViewModel } from '@/utilities/municipalityViewModels'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'
import { aggregateMunicipalityPledgesFromRows, type MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

/**
 * E16 dossiê — section caps. The dossier is a 1–2 page pre-visit read, not a
 * report: each section shows at most this many rows and links to its full tab.
 */
export const DOSSIER_LEADERSHIP_LIMIT = 8
export const DOSSIER_SIGNAL_LIMIT = 5
const DOSSIER_UPCOMING_PLAN_LIMIT = 3
const DOSSIER_RECENT_PLAN_LIMIT = 2

export type MunicipalityDossierData = {
  baseline: MunicipalityElectoralBaseline | null
  goalAccount: MunicipalityGoalAccount | null
  pledgeAggregate: MunicipalityPledgeAggregate
  leaderships: { rows: LeadershipRowViewModel[]; totalCount: number }
  signals: { rows: MunicipalityUpdateViewModel[]; totalCount: number }
  upcomingPlans: ActionPlanListViewModel[]
  recentPlans: ActionPlanListViewModel[]
  demographics: MunicipalityDemographics | null
}

const loadDossierPlans = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<{ upcoming: ActionPlanListViewModel[]; recent: ActionPlanListViewModel[] }> => {
  const now = new Date()
  const findPlans = (tab: 'proximos' | 'realizados', limit: number, sort: string) =>
    payload.find({
      collection: 'actionPlan',
      where: buildActionPlanListWhere({ page: 1, tab, municipality: municipalityID }, now),
      depth: 0,
      limit,
      pagination: false,
      sort,
      select: actionPlanListSelect,
      user,
      overrideAccess: false,
    })

  const [upcoming, recent] = await Promise.all([
    findPlans('proximos', DOSSIER_UPCOMING_PLAN_LIMIT, 'startAt'),
    findPlans('realizados', DOSSIER_RECENT_PLAN_LIMIT, '-startAt'),
  ])

  return {
    upcoming: upcoming.docs.map((plan) => toActionPlanListViewModel(plan as ActionPlan)),
    recent: recent.docs.map((plan) => toActionPlanListViewModel(plan as ActionPlan)),
  }
}

/**
 * Composes the pre-visit dossier from the same loaders the detail tabs use —
 * one pass, no second source of truth (decisão travada do plano E16).
 */
export const loadMunicipalityDossierData = async (
  payload: Payload,
  user: CampaignUser,
  view: MunicipalityDetailViewModel,
): Promise<MunicipalityDossierData> => {
  const geography = municipalityElectionGeographyForSlug(view.slug)

  const [baseline, pledgesAndGoal, leaderships, feed, plans] = await Promise.all([
    geography ? loadMunicipalityElectoralBaseline(user, geography) : null,
    loadMunicipalityPledges(payload, user, view.id).then(async (pledges) => {
      const pledgeAggregate = aggregateMunicipalityPledgesFromRows(pledges)
      const goalAccount = view.strategy
        ? await loadMunicipalityGoalAccount(
            payload,
            user,
            { slug: view.slug, expectedVotes: view.strategy.expectedVotes },
            pledgeAggregate,
          )
        : null
      return { pledgeAggregate, goalAccount }
    }),
    loadFreshestMunicipalityLeaderships(payload, user, view.id, DOSSIER_LEADERSHIP_LIMIT),
    loadMunicipalityUpdatesFeed(payload, user, view.id, { page: 1 }),
    loadDossierPlans(payload, user, view.id),
  ])

  return {
    baseline,
    goalAccount: pledgesAndGoal.goalAccount,
    pledgeAggregate: pledgesAndGoal.pledgeAggregate,
    leaderships,
    signals: { rows: feed.updates.slice(0, DOSSIER_SIGNAL_LIMIT), totalCount: feed.totalDocs },
    upcomingPlans: plans.upcoming,
    recentPlans: plans.recent,
    demographics: demographicsForCode(view.ibgeCode) ?? null,
  }
}
