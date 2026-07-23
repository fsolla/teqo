import type { VoteEstimateScenarioViewModel } from '@/utilities/voteEstimate'

export type PlazaListExpectedVotesResponse =
  | {
      status: 'success'
      message: string
      savedExpectedVotes: VoteEstimateScenarioViewModel
    }
  | {
      status: 'error'
      message: string
    }
