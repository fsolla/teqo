import type { VoteEstimateScenarioViewModel } from '@/utilities/voteEstimate'

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
