import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

export const MUNICIPALITY_EXPECTED_VOTES_ENDPOINT = '/campanha/municipios/expected-votes' as const

export type MunicipalityListExpectedVotesResponse =
  | {
      status: 'success'
      message: string
      savedExpectedVotes: VoteEstimateScenarioViewModel
    }
  | {
      status: 'error'
      message: string
    }
