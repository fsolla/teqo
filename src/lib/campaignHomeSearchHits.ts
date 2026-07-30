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
  phone: string | null
  municipalityCount: number
}

export type HomeSearchLeadershipHit = {
  kind: 'leadership'
  id: number
  name: string
  phone: string | null
  municipalitiesSummary: string
}

export type HomeSearchStateDeputyHit = {
  slug: string
  name: string
  party: string | null
  municipalityCount: number
}

export type HomeSearchActivityHit = {
  id: number
  slug: string
  title: string
  secondary: string
}

export type HomeSearchDemandHit = {
  id: number
  slug: string
  title: string
  secondary: string
}

type HomeSearchResultKind = 'search' | 'suggest'

export type HomeSearchSuccessResponse = {
  status: 'success'
  resultKind: HomeSearchResultKind
  municipalities: HomeSearchMunicipalityHit[]
  territories: HomeSearchTerritoryHit[]
  advisors: HomeSearchAdvisorHit[]
  leaderships: HomeSearchLeadershipHit[]
  stateDeputies: HomeSearchStateDeputyHit[]
  activities: HomeSearchActivityHit[]
  demands: HomeSearchDemandHit[]
}

export const homeSearchMunicipalityGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'municipalities' | 'territories'>,
): boolean => data.municipalities.length > 0 || data.territories.length > 0

export const homeSearchLeadershipGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'leaderships'>,
): boolean => data.leaderships.length > 0

export const homeSearchStateDeputyGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'stateDeputies'>,
): boolean => data.stateDeputies.length > 0

export const homeSearchActivityGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'activities'>,
): boolean => data.activities.length > 0

export const homeSearchDemandGroupHasHits = (
  data: Pick<HomeSearchSuccessResponse, 'demands'>,
): boolean => data.demands.length > 0

export const formatHomeSearchMunicipalityCount = (count: number): string => {
  if (count === 1) return '1 município'
  return `${count} municípios`
}

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
  homeSearchMunicipalityGroupHasHits(data) ||
  data.advisors.length > 0 ||
  homeSearchLeadershipGroupHasHits(data) ||
  homeSearchStateDeputyGroupHasHits(data) ||
  homeSearchActivityGroupHasHits(data) ||
  homeSearchDemandGroupHasHits(data)

export type WizardMunicipalitySearchSuccessResponse = {
  status: 'success'
  municipalities: HomeSearchMunicipalityHit[]
}
