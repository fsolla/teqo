import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import type { SuggestedGoalByScenario } from '@/utilities/municipality/municipalityPotential'
import type { MunicipalityPledgeAggregate } from '@/utilities/votePledgeViews'

export type MunicipalityV2ContaViewModel = {
  municipalityID: number
  expectedVotes: VoteEstimateScenarioViewModel
  suggestedGoalByScenario: SuggestedGoalByScenario
  pledgeAggregate: MunicipalityPledgeAggregate
}
