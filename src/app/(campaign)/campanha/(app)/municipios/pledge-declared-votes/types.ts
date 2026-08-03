export const MUNICIPALITY_PLEDGE_DECLARED_VOTES_ENDPOINT = '/campanha/municipios/pledge-declared-votes'

export type MunicipalityPledgeDeclaredVotesResponse =
  | { status: 'success'; message: string; savedDeclaredVotes: number; pledgeId: number }
  | { status: 'error'; message: string }
