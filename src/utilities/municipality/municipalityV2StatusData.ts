import 'server-only'

import type { Payload } from 'payload'

import type { MunicipalitySignalType } from '@/lib/schemas/municipalityUpdate'
import type { CampaignUser } from '@/payload-types'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
  type AccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { resolveMunicipalityLastSignalAt } from '@/utilities/municipality/municipalitySignal'
import { computeMunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { loadMunicipalityUpdatesFeed } from '@/utilities/municipality/municipalityUpdatePageData'
import type { MunicipalityV2StatusViewModel } from '@/utilities/municipality/municipalityV2StatusView'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'
import { aggregateMunicipalityPledgesFromRows } from '@/utilities/votePledgeViews'

export type { MunicipalityV2StatusViewModel }

const loadLatestSignal = async (
  payload: Payload,
  user: CampaignUser,
  municipalityID: number,
): Promise<{ type: MunicipalitySignalType | null; body: string | null }> => {
  const feed = await loadMunicipalityUpdatesFeed(payload, user, municipalityID, {
    page: 1,
    kind: 'sinal',
  })
  const latest = feed.updates[0]
  if (!latest) return { type: null, body: null }
  return { type: latest.signalType, body: latest.body }
}

export const loadMunicipalityV2StatusData = async (
  payload: Payload,
  user: CampaignUser,
  municipalitySlug: string,
): Promise<{ context: AccessibleMunicipalityContext; status: MunicipalityV2StatusViewModel }> => {
  const context = await resolveAccessibleMunicipalityContext(payload, user, municipalitySlug)
  const [view, pledges, latestSignal] = await Promise.all([
    getMunicipalityDetailViewModel(payload, context, user),
    loadMunicipalityPledges(payload, user, context.id),
    loadLatestSignal(payload, user, context.id),
  ])

  const strategy = view.strategy
  if (!strategy) {
    // Page gate is noLeader; strategy should always be present for staff.
    throw new Error('Municipality v2 status requires a staff strategy view model.')
  }

  const pledgeAggregate = aggregateMunicipalityPledgesFromRows(pledges)
  const lastSignalAt = resolveMunicipalityLastSignalAt(
    view.lastUpdateAt,
    pledgeAggregate.lastPledgeAt,
  )

  return {
    context,
    status: {
      id: view.id,
      name: view.name,
      slug: view.slug,
      canMoveEngagementLevel: isCampaignUnrestricted(user),
      engagementLevel: strategy.engagementLevel,
      levelNote: strategy.levelNote,
      levelChangedAt: strategy.levelChangedAt,
      politicalTrendStatus: strategy.politicalTrend.status,
      politicalTrendNote: strategy.politicalTrend.note,
      lastSignalAt,
      lastSignalType: latestSignal.type,
      lastSignalBody: latestSignal.body,
      territorialClass: computeMunicipalityTerritorialClass(view.slug),
    },
  }
}
