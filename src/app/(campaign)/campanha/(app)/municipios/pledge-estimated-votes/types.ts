import type { VoteEstimateScenarioViewModel } from '@/lib/voteEstimate'

export const MUNICIPALITY_PLEDGE_ESTIMATED_VOTES_ENDPOINT =
  '/campanha/municipios/pledge-estimated-votes'

export type MunicipalityPledgeEstimatedVotesResponse =
  | {
      status: 'success'
      message: string
      savedEstimatedVotes: VoteEstimateScenarioViewModel
    }
  | { status: 'error'; message: string }
