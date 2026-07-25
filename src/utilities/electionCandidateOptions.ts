import 'server-only'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
} from '@/lib/electionResults'
import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { ELECTION_TSE_CACHE_TAG } from '@/utilities/electionCache'

export type FederalCandidateOption = {
  candidateNumber: number
  name: string
  party: string | null
  totalVotesState: number
}

/** Cross-request cached core — immutable 2022 registry, busted with `election-tse`. */
const loadFederalCandidateOptionsCached = unstable_cache(
  async (limit: number): Promise<FederalCandidateOption[]> => {
    const payload = await getPayload({ config: configPromise })
    return queryFederalCandidateOptions(limit, payload)
  },
  ['federal-candidate-options'],
  { tags: [ELECTION_TSE_CACHE_TAG] },
)

/**
 * Federal-deputy candidates available for comparison (2022 registry ordered by
 * statewide votes). Solla himself is excluded — he is always the reference.
 */
export const loadFederalCandidateOptions = (
  user: CampaignUser | User,
  limit = 60,
): Promise<FederalCandidateOption[]> => {
  assertCanReadElectionData(user)
  return loadFederalCandidateOptionsCached(limit)
}

const queryFederalCandidateOptions = async (
  limit: number,
  payload: Awaited<ReturnType<typeof getPayload>>,
): Promise<FederalCandidateOption[]> => {
  const result = await payload.find({
    collection: 'electionCandidate',
    where: {
      and: [
        { year: { equals: ELECTION_YEAR_2022 } },
        { office: { equals: FEDERAL_DEPUTY_OFFICE } },
        { turn: { equals: '1' } },
        { candidateNumber: { not_equals: BASELINE_TICKET_2022.candidate.candidateNumber } },
        // NULL totals sort first on DESC in Postgres — and a candidate without
        // statewide votes is useless as a comparison target anyway.
        { totalVotesState: { greater_than: 0 } },
      ],
    },
    depth: 0,
    limit,
    pagination: false,
    sort: '-totalVotesState',
    select: { candidateNumber: true, urnaName: true, party: true, totalVotesState: true },
    overrideAccess: true,
  })

  return result.docs.map((candidate) => ({
    candidateNumber: candidate.candidateNumber,
    name: candidate.urnaName,
    party: candidate.party ?? null,
    totalVotesState: candidate.totalVotesState ?? 0,
  }))
}
