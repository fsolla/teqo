import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'
import { formatMunicipalitySuggestionEmptyMessage } from '@/utilities/municipality/municipalitySignal'
import { loadMunicipalitySuggestions } from '@/utilities/municipality/municipalityTriggers'
import type { MunicipalityV2AgoraViewModel } from '@/utilities/municipality/municipalityV2AgoraView'
import { formatVisitEligibilitySummary } from '@/utilities/visit/visitEligibility'
import { loadMunicipalityVisitEligibility } from '@/utilities/visit/visitPlannerData'

const MAX_AGORA_SUGGESTIONS = 2

export const loadMunicipalityV2AgoraData = async (
  payload: Payload,
  user: CampaignUser,
  municipalitySlug: string,
): Promise<MunicipalityV2AgoraViewModel> => {
  const context = await resolveAccessibleMunicipalityContext(payload, user, municipalitySlug)
  const [view, suggestionBundle, visit] = await Promise.all([
    getMunicipalityDetailViewModel(payload, context, user),
    loadMunicipalitySuggestions(payload, user, { municipalityID: context.id }),
    loadMunicipalityVisitEligibility(payload, user, municipalitySlug),
  ])

  const strategy = view.strategy
  if (!strategy) {
    throw new Error('Municipality v2 Agora requires a staff strategy view model.')
  }

  const silence = suggestionBundle.silence.find((entry) => entry.municipalityID === context.id)
  const suggestionSilence =
    suggestionBundle.suggestions.length === 0
      ? formatMunicipalitySuggestionEmptyMessage(
          silence ? { lastSignalAgeDays: silence.lastSignalAgeDays } : null,
        )
      : null

  return {
    municipalityID: view.id,
    municipalityName: view.name,
    nextSteps: strategy.nextSteps,
    suggestions: suggestionBundle.suggestions
      .slice(0, MAX_AGORA_SUGGESTIONS)
      .map(({ metrics: _metrics, ...card }) => card),
    suggestionSilence,
    visit: {
      summary: visit.candidate ? formatVisitEligibilitySummary(visit.candidate.eligibility) : null,
      region: visit.candidate?.region ?? null,
    },
  }
}
