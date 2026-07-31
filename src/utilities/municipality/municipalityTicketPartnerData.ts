import 'server-only'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
} from '@/lib/electionResults'
import {
  computeTicketPartnerOpportunities,
  isTicketPartnerOffice,
  TICKET_PARTNER_OFFICES,
  type TicketPartnerInput,
  type TicketPartnerOffice,
  type TicketPartnerResult,
} from '@/lib/ticketPartnerOpportunities'
import type { CampaignUser, User } from '@/payload-types'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { ELECTION_TSE_CACHE_TAG } from '@/utilities/electionCache'
import {
  municipalityGeographyWhere,
  type MunicipalityElectionGeography,
} from '@/utilities/municipality/municipalityElectionGeography'

/**
 * A6 — dobradinha opportunities for one municipality geography (detail,
 * Elections tab). Module policy mirrors the sibling election loaders: the
 * public loader checks the actor once (`assertCanReadElectionData`), and the
 * cached core reads with `overrideAccess: true` — an admin bypass justified by
 * the audience (any authenticated campaign/admin user) and by public TSE data
 * carrying no row-level ACL. Entries live until the `election-tse` tag is
 * busted; the Fase 5 reconcile of `runningAgain2026` (post-15/08) must end
 * with the same `POST /api/revalidate?tag=election-tse` step as a re-seed.
 */

/** Cross-request cached core — the geography argument is part of the cache key. */
const loadMunicipalityTicketPartnersCached = unstable_cache(
  async (geography: MunicipalityElectionGeography): Promise<TicketPartnerResult> => {
    const payload = await getPayload({ config: configPromise })
    return queryMunicipalityTicketPartners(payload, geography)
  },
  ['municipality-ticket-partners'],
  { tags: [ELECTION_TSE_CACHE_TAG] },
)

export const loadMunicipalityTicketPartners = (
  user: CampaignUser | User,
  geography: MunicipalityElectionGeography,
): Promise<TicketPartnerResult> => {
  assertCanReadElectionData(user)
  return loadMunicipalityTicketPartnersCached(geography)
}

const votesKey = (office: TicketPartnerOffice, candidateNumber: number) =>
  `${office}:${candidateNumber}`

/**
 * Uncached core, exported so the int spec exercises the real geography join —
 * `unstable_cache` needs the Next server runtime and cannot run under vitest.
 * Three small queries instead of a statewide scan: an EXISTS probe for the
 * 2026 reconciliation, the 2022 proportional votes inside the geography, and
 * the registry read only for the numbers that actually voted there.
 */
export const queryMunicipalityTicketPartners = async (
  payload: Payload,
  geography: MunicipalityElectionGeography,
): Promise<TicketPartnerResult> => {
  const proportionalClauses: Where[] = [
    { year: { equals: ELECTION_YEAR_2022 } },
    { office: { in: [...TICKET_PARTNER_OFFICES] } },
    { turn: { equals: '1' } },
  ]

  // Fase 5 flips `runningAgain2026` off 'desconhecido' once the TSE publishes
  // the 2026 candidacies; until then the insight is unavailable everywhere.
  const reconciled = await payload.count({
    collection: 'electionCandidate',
    where: { and: [...proportionalClauses, { runningAgain2026: { in: ['sim', 'nao'] } }] },
    overrideAccess: true,
  })
  if (reconciled.totalDocs === 0) return { status: 'pending2026' }

  const votes = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        ...proportionalClauses,
        { voteType: { equals: 'nominal' } },
        municipalityGeographyWhere(geography),
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { office: true, candidateNumber: true, votes: true },
    overrideAccess: true,
  })
  if (votes.docs.length === 0) return { status: 'ready', opportunities: [] }

  const votesByKey = new Map<string, number>()
  const numbersByOffice = new Map<TicketPartnerOffice, Set<number>>()
  for (const row of votes.docs) {
    if (!isTicketPartnerOffice(row.office)) continue
    const key = votesKey(row.office, row.candidateNumber)
    votesByKey.set(key, (votesByKey.get(key) ?? 0) + (row.votes ?? 0))
    const numbers = numbersByOffice.get(row.office) ?? new Set<number>()
    numbers.add(row.candidateNumber)
    numbersByOffice.set(row.office, numbers)
  }

  const officeNumberClauses: Where[] = [...numbersByOffice.entries()].map(
    ([office, numbers]): Where => ({
      and: [{ office: { equals: office } }, { candidateNumber: { in: [...numbers] } }],
    }),
  )
  if (officeNumberClauses.length === 0) return { status: 'ready', opportunities: [] }

  const registry = await payload.find({
    collection: 'electionCandidate',
    where: {
      and: [
        ...proportionalClauses,
        { runningAgain2026: { equals: 'sim' } },
        { or: officeNumberClauses },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: {
      office: true,
      candidateNumber: true,
      urnaName: true,
      party: true,
      elected: true,
    },
    overrideAccess: true,
  })

  const candidates: TicketPartnerInput[] = []
  for (const candidate of registry.docs) {
    if (!isTicketPartnerOffice(candidate.office)) continue
    // Solla is the reference the dobradinhas orbit — never a partner row.
    if (
      candidate.office === FEDERAL_DEPUTY_OFFICE &&
      candidate.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber
    ) {
      continue
    }
    candidates.push({
      office: candidate.office,
      candidateNumber: candidate.candidateNumber,
      name: candidate.urnaName,
      party: candidate.party ?? null,
      elected2022: candidate.elected ?? false,
      votes2022: votesByKey.get(votesKey(candidate.office, candidate.candidateNumber)) ?? 0,
    })
  }

  return { status: 'ready', opportunities: computeTicketPartnerOpportunities(candidates) }
}
