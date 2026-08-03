import type { SuggestionCardData } from '@/components/campaign/suggestion/SuggestionCard'
import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import type { VisitEligibilitySummary } from '@/utilities/visit/visitEligibility'

export type MunicipalityV2AgoraViewModel = {
  municipalityID: number
  municipalityName: string
  nextSteps: string | null
  suggestions: SuggestionCardData[]
  suggestionSilence: string | null
  visit: {
    summary: VisitEligibilitySummary | null
    region: BahiaIdentityTerritory | null
  }
}
