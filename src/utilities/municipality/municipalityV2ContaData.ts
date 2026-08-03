import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import { loadStatewideSuggestedGoals } from '@/utilities/municipality/municipalityGoalAccount'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import type { SuggestedGoalByScenario } from '@/utilities/municipality/municipalityPotential'
import type { MunicipalityV2ContaViewModel } from '@/utilities/municipality/municipalityV2ContaView'
import { loadMunicipalityPledges } from '@/utilities/votePledgeData'
import { aggregateMunicipalityPledgesFromRows } from '@/utilities/votePledgeViews'

const emptySuggestedGoalByScenario: Readonly<SuggestedGoalByScenario> = {
  pessimistic: 0,
  central: 0,
  optimistic: 0,
}

export const loadMunicipalityV2ContaData = async (
  payload: Payload,
  user: CampaignUser,
  municipalitySlug: string,
): Promise<MunicipalityV2ContaViewModel> => {
  const context = await resolveAccessibleMunicipalityContext(payload, user, municipalitySlug)
  const [view, pledges, { suggestedGoalBySlug }] = await Promise.all([
    getMunicipalityDetailViewModel(payload, context, user),
    loadMunicipalityPledges(payload, user, context.id),
    loadStatewideSuggestedGoals(payload, user),
  ])

  const strategy = view.strategy
  if (!strategy) {
    throw new Error('Municipality v2 conta requires a staff strategy view model.')
  }

  const pledgeAggregate = aggregateMunicipalityPledgesFromRows(pledges)
  const suggestedGoalByScenario = suggestedGoalBySlug.get(view.slug) ?? emptySuggestedGoalByScenario

  return {
    municipalityID: view.id,
    expectedVotes: strategy.expectedVotes,
    suggestedGoalByScenario,
    pledgeAggregate,
  }
}
