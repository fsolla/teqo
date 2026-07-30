import {
  DEFAULT_VOTE_RANK_YEAR,
  getMunicipalityVoteRank,
  type MunicipalityVoteRankEntry,
} from '@/lib/municipalityVoteRank'

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

export type HomeSearchAdvisorHit = {
  id: number
  name: string
  municipalityCount: number
}

type HomeSearchResultKind = 'search' | 'suggest'

export type HomeSearchSuccessResponse = {
  status: 'success'
  resultKind: HomeSearchResultKind
  municipalities: HomeSearchMunicipalityHit[]
  territories: HomeSearchTerritoryHit[]
  advisors: HomeSearchAdvisorHit[]
}

export const homeSearchMunicipalityGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'municipalities' | 'territories'>,
): boolean => data.municipalities.length > 0 || data.territories.length > 0

export const toHomeSearchMunicipalityHit = (doc: {
  slug: string
  name: string
  region: string
  priority?: 'alta' | 'normal' | null
}): HomeSearchMunicipalityHit => ({
  kind: 'municipality',
  slug: doc.slug,
  name: doc.name,
  region: doc.region,
  priority: doc.priority ?? null,
  votePosition2022: getMunicipalityVoteRank(doc.slug, DEFAULT_VOTE_RANK_YEAR),
})

export const homeSearchHasAnyHits = (data: HomeSearchSuccessResponse): boolean =>
  homeSearchMunicipalityGroupHasHits(data) || data.advisors.length > 0
