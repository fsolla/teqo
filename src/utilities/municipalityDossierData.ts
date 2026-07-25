import 'server-only'

import type { Payload } from 'payload'

import {
  demographicsForCode,
  type MunicipalityDemographics,
} from '@/lib/bahiaMunicipalityDemographics'
import type { Activity, CampaignUser } from '@/payload-types'
import { buildActivityListWhere } from '@/utilities/activityUi'
import {
  activityListSelect,
  toActivityListViewModel,
  type ActivityListViewModel,
} from '@/utilities/activityViewModels'
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
import {
  aggregateMunicipalityPledgesFromRows,
  type MunicipalityPledgeAggregate,
} from '@/utilities/votePledgeViews'

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
  upcomingActivities: ActivityListViewModel[]
  recentActivities: ActivityListViewModel[]
  demographics: MunicipalityDemographics | null
}

const loadDossierActivities = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<{ upcoming: ActivityListViewModel[]; recent: ActivityListViewModel[] }> => {
  const now = new Date()
  const findActivities = (tab: 'proximos' | 'realizados', limit: number, sort: string) =>
    payload.find({
      collection: 'activity',
      where: buildActivityListWhere({ page: 1, tab, municipality: municipalityID }, now),
      depth: 0,
      limit,
      pagination: false,
      sort,
      select: activityListSelect,
      user,
      overrideAccess: false,
    })

  const [upcoming, recent] = await Promise.all([
    findActivities('proximos', DOSSIER_UPCOMING_PLAN_LIMIT, 'startAt'),
    findActivities('realizados', DOSSIER_RECENT_PLAN_LIMIT, '-startAt'),
  ])

  return {
    upcoming: upcoming.docs.map((activity) => toActivityListViewModel(activity as Activity)),
    recent: recent.docs.map((activity) => toActivityListViewModel(activity as Activity)),
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

  const [baseline, pledgesAndGoal, leaderships, feed, activities] = await Promise.all([
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
    loadDossierActivities(payload, user, view.id),
  ])

  return {
    baseline,
    goalAccount: pledgesAndGoal.goalAccount,
    pledgeAggregate: pledgesAndGoal.pledgeAggregate,
    leaderships,
    signals: { rows: feed.updates.slice(0, DOSSIER_SIGNAL_LIMIT), totalCount: feed.totalDocs },
    upcomingActivities: activities.upcoming,
    recentActivities: activities.recent,
    demographics: demographicsForCode(view.ibgeCode) ?? null,
  }
}
