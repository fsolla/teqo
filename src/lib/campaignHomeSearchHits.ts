import type { MunicipalityVoteRankEntry } from '@/lib/municipalityVoteRank'

export type HomeSearchMunicipalityHit = {
  kind: 'municipality'
  slug: string
  name: string
  region: string
  priority: 'alta' | 'normal' | null
  votePosition2022: MunicipalityVoteRankEntry | null
}

export type HomeSearchTerritoryHit = {
  kind: 'territory'
  region: string
  votes2022: number
}

export type HomeSearchSuccessResponse = {
  status: 'success'
  municipalities: HomeSearchMunicipalityHit[]
  territories: HomeSearchTerritoryHit[]
}

export const homeSearchMunicipalityGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'municipalities' | 'territories'>,
): boolean => data.municipalities.length > 0 || data.territories.length > 0
