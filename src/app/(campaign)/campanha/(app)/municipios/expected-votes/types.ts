import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

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
