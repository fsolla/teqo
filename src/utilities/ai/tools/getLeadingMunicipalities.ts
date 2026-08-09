import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { tool } from 'ai'
import type { Where } from 'payload'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { municipalityForTseCityCode } from '@/lib/bahiaTseCityCodes'
import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
  HISTORICAL_SERIES_YEARS,
} from '@/lib/electionResults'
import {
  campaignCandidateLeadingMunicipalities,
  cityPageSlug,
  sortLeadingMunicipalityRows,
  type LeadingMunicipalityRow,
} from '@/lib/leadingMunicipalities'
import { municipalityCatalogEntriesForCity } from '@/lib/municipalityCatalog'
import { electionDataGate } from '@/utilities/ai/tools/electionDataGate'
import { assertCanReadElectionData } from '@/utilities/campaignAccess'
import { drizzleResultRows } from '@/utilities/drizzleBulk'

/** Valid election years for the chat — the same TSE series the baseline reads. */
const VOTE_YEARS: readonly number[] = HISTORICAL_SERIES_YEARS

const MAX_TOP_N = 20

type CandidateIdentity = {
  candidateNumber: number
  name: string
  party: string | null
}

type DeputyResolution = CandidateIdentity | { error: string; options?: CandidateIdentity[] }

type LeadingMunicipalitiesRow = {
  city_code: string
  candidate_number: number
  candidate_name: string
  party: string | null
  votes: number
  rank: number
  voted_candidates: number
}

/**
 * Per-city window ranking of every federal deputy for one year, filtered to
 * the target candidate's placements up to `topN`. The `RANK()` over
 * `votes DESC` after keeping only candidates with votes reproduces the
 * artifact builder's semantics exactly: rank = candidates strictly ahead + 1
 * (ties share a placement), the denominator is the voted candidates, a
 * candidate with no votes in a city yields no row. Zone rows are folded per
 * city by the CTE, so Salvador's 19 zones rank as one city.
 *
 * `office`/`turn`/`vote_type`/`state` are the collection's enum/text columns
 * and MUST stay inline literals — a param-bound string against an enum column
 * fails Postgres typing. They come from closed TSE constants, never user
 * input; only year/candidateNumber/topN are bound.
 */
const buildLeadingMunicipalitiesSql = ({
  year,
  candidateNumber,
  topN,
}: {
  year: number
  candidateNumber: number
  topN: number
}) => sql`
  WITH per_city_candidate AS (
    SELECT
      "city_code",
      "candidate_number",
      MAX("candidate_name") AS "candidate_name",
      MAX("party") AS "party",
      SUM("votes") AS "votes"
    FROM "election_candidate_vote"
    WHERE "year" = ${year}
      AND "office" = 'deputado_federal'
      AND "turn" = '1'
      AND "vote_type" = 'nominal'
      AND "state" = 'BA'
    GROUP BY "city_code", "candidate_number"
  ),
  ranked AS (
    SELECT
      "city_code",
      "candidate_number",
      "candidate_name",
      "party",
      "votes",
      RANK() OVER (PARTITION BY "city_code" ORDER BY "votes" DESC) AS "rank",
      COUNT(*) OVER (PARTITION BY "city_code") AS "voted_candidates"
    FROM per_city_candidate
    WHERE "votes" > 0
  )
  SELECT
    "city_code",
    "candidate_number",
    "candidate_name",
    "party",
    "votes",
    "rank",
    "voted_candidates"
  FROM ranked
  WHERE "candidate_number" = ${candidateNumber}
    AND "rank" <= ${topN}
  ORDER BY "rank" ASC, "votes" DESC
`

type PostgresDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>
}

/**
 * Live reversed ranking for an arbitrary federal deputy, straight from the
 * TSE vote collections — the only producer for non-campaign candidates. The
 * heavy window aggregation runs inside Postgres; only the target candidate's
 * rows travel to Node.
 *
 * Third-party ranks read the raw TSE city scope (every row under the city
 * code, leaky zones included); the campaign candidate always reads the
 * catalog-cut artifact, so the map's reading is never affected by the cut.
 */
export const loadLeadingMunicipalitiesForCandidate = async (
  payload: AIToolContext['payload'],
  user: AIToolContext['user'],
  { candidateNumber, year, topN }: { candidateNumber: number; year: number; topN: number },
): Promise<LeadingMunicipalityRow[]> => {
  // Fail-closed at the loader too, mirroring the municipality election loaders:
  // a future caller that forgets the tool gate cannot serve a leader anyway.
  assertCanReadElectionData(user)

  if (payload.db.name !== 'postgres') {
    throw new Error('A leitura de cidades líderes exige o adaptador PostgreSQL.')
  }

  const database = payload.db as unknown as { drizzle?: PostgresDb }
  const drizzle = database.drizzle
  if (!drizzle || typeof drizzle.execute !== 'function') {
    throw new Error('A sessão PostgreSQL da leitura de cidades líderes não está disponível.')
  }

  const result = await drizzle.execute(
    buildLeadingMunicipalitiesSql({ year, candidateNumber, topN }),
  )
  const rows = (drizzleResultRows(result) as unknown as LeadingMunicipalitiesRow[]) ?? []

  const leading: LeadingMunicipalityRow[] = []
  for (const row of rows) {
    // city_code is the catalog's TSE code — every seeded row resolves; an
    // unknown code is skipped defensively instead of leaking a raw TSE name.
    const city = municipalityForTseCityCode(row.city_code)
    if (!city) continue
    leading.push({
      city,
      slug: cityPageSlug(municipalityCatalogEntriesForCity(city)),
      rank: Number(row.rank),
      votedCandidates: Number(row.voted_candidates),
      votes: Number(row.votes),
    })
  }

  return sortLeadingMunicipalityRows(leading)
}

/** The four scope conditions shared by the candidate registry and vote rows. */
const candidateScopeWhere = (year: number): Where => ({
  and: [
    { year: { equals: year } },
    { office: { equals: FEDERAL_DEPUTY_OFFICE } },
    { turn: { equals: '1' } },
    { state: { equals: 'BA' } },
  ],
})

/**
 * Ballot-number or name fragments for one collection. A number matches the
 * unique per-scope candidateNumber; a name is folded with `like` (Payload's
 * operator is case-insensitive and adds wildcards).
 */
const nameOrNumberFragments = (input: string, nameField: 'urnaName' | 'candidateName'): Where => {
  const numeric = /^\d+$/.test(input) ? Number(input) : null
  if (numeric !== null) return { candidateNumber: { equals: numeric } }
  if (nameField === 'candidateName') return { candidateName: { like: input } }
  return { or: [{ urnaName: { like: input } }, { completeName: { like: input } }] }
}

const collectDistinctCandidates = (
  docs: ReadonlyArray<{ candidateNumber: number; name: string; party: string | null }>,
): Map<number, { name: string; party: string | null }> => {
  const byNumber = new Map<number, { name: string; party: string | null }>()
  for (const doc of docs) {
    const number = Number(doc.candidateNumber)
    if (!byNumber.has(number)) {
      byNumber.set(number, { name: doc.name, party: doc.party })
    }
  }
  return byNumber
}

/** Fallback: distinct federal-deputy rows of the year when the registry misses. */
const resolveFromVoteRows = async (
  payload: AIToolContext['payload'],
  year: number,
  input: string,
): Promise<Map<number, { name: string; party: string | null }>> => {
  const scope = candidateScopeWhere(year)
  const votes = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        ...scope.and!,
        { voteType: { equals: 'nominal' } },
        nameOrNumberFragments(input, 'candidateName'),
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { candidateNumber: true, candidateName: true, party: true },
    // Bypass: public TSE vote rows; access gated by assertCanReadElectionData at the tool level.
    overrideAccess: true,
  })

  return collectDistinctCandidates(
    (
      votes.docs as unknown as Array<{
        candidateNumber: number
        candidateName: string
        party: string | null
      }>
    ).map((doc) => ({
      candidateNumber: doc.candidateNumber,
      name: doc.candidateName,
      party: doc.party ?? null,
    })),
  )
}

/**
 * Resolve a user-spoken federal deputy (ballot number or name) inside one
 * year. Preference order: number in the candidate registry, name in the
 * registry, then distinct rows in the vote collection. More than one distinct
 * candidate → options so the model can disambiguate; none → error. Exported
 * for the int spec to pin the "number or name" acceptance.
 */
export const resolveFederalDeputy = async (
  payload: AIToolContext['payload'],
  year: number,
  input: string,
): Promise<DeputyResolution> => {
  const scope = candidateScopeWhere(year)
  const registry = await payload.find({
    collection: 'electionCandidate',
    where: {
      and: [...scope.and!, nameOrNumberFragments(input, 'urnaName')],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { candidateNumber: true, urnaName: true, party: true },
    // Bypass: public TSE candidate registry; access gated by assertCanReadElectionData at the tool level.
    overrideAccess: true,
  })

  let byNumber = collectDistinctCandidates(
    (
      registry.docs as unknown as Array<{
        candidateNumber: number
        urnaName: string
        party: string | null
      }>
    ).map((doc) => ({
      candidateNumber: doc.candidateNumber,
      name: doc.urnaName,
      party: doc.party ?? null,
    })),
  )

  if (byNumber.size === 0) {
    byNumber = await resolveFromVoteRows(payload, year, input)
  }

  if (byNumber.size > 1) {
    return {
      error: `Encontrei mais de um deputado federal em ${year} para "${input}". Peça o número da urna para escolher:`,
      options: [...byNumber.entries()].slice(0, 10).map(([candidateNumber, identity]) => ({
        candidateNumber,
        name: identity.name,
        party: identity.party,
      })),
    }
  }

  const match = [...byNumber.entries()][0]
  if (!match) {
    return {
      error: `Não encontrei deputado federal em ${year} com número/nome "${input}". Verifique e tente de novo.`,
    }
  }

  const [candidateNumber, identity] = match
  return { candidateNumber, name: identity.name, party: identity.party }
}

export const getLeadingMunicipalities = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns the municipalities where a federal deputy was the most voted (rank 1) or placed up to rank N, for a year. ' +
      'The reversed reading of getTopDeputies: candidate → cities, not city → candidates. ' +
      'Default candidate is the campaign candidate (Jorge Solla); any federal deputy can be queried by ballot number or name. ' +
      'Ties share a placement; each city appears once (Salvador as a single city, never its 19 zones). ' +
      'Use when the user asks "em quais cidades X foi o deputado mais votado?" / "onde X ficou em primeiro?" / "top N em quais cidades?". ' +
      'Years: 2014, 2018 or 2022 (2022 default).',
    inputSchema: z.object({
      candidate: z
        .string()
        .optional()
        .describe(
          'Federal deputy by ballot number (e.g. "1313") or name (e.g. "Jorge Solla"). Omit for the campaign candidate (Jorge Solla).',
        ),
      year: z
        .number()
        .int()
        .optional()
        .default(ELECTION_YEAR_2022)
        .describe('Election year: 2014, 2018 or 2022.'),
      topN: z
        .number()
        .int()
        .optional()
        .default(1)
        .describe(
          'Maximum placement to include: 1 = most voted, 3 = among the three most voted, etc. (max 20).',
        ),
    }),
    execute: async ({ candidate, year, topN }) => {
      // Leader lockdown: municipal ranking conversations are staff-only.
      const gate = electionDataGate(ctx)
      if (gate !== true) return gate

      if (!VOTE_YEARS.includes(year)) {
        return {
          error: 'Apenas os anos 2014, 2018 e 2022 têm dados eleitorais. Escolha um deles.',
        }
      }
      const safeTopN = Math.min(Math.max(Math.trunc(topN), 1), MAX_TOP_N)

      const normalized = candidate?.trim()
      if (!normalized) {
        return campaignCandidateLeadingMunicipalities(year, safeTopN)
      }

      const resolution = await resolveFederalDeputy(ctx.payload, year, normalized)
      if ('error' in resolution) return resolution

      if (resolution.candidateNumber === BASELINE_TICKET_2022.candidate.candidateNumber) {
        // The campaign candidate reads the committed artifact, even when the
        // user spells him by number/name — one source, never two.
        return campaignCandidateLeadingMunicipalities(year, safeTopN)
      }

      const municipalities = await runForCandidate(ctx, resolution, year, safeTopN)
      if ('error' in municipalities) return municipalities

      return {
        candidate: resolution,
        year,
        topN: safeTopN,
        total: municipalities.length,
        municipalities,
      }
    },
  })

/** Executes the SQL producer, converting loader guards into chat feedback. */
const runForCandidate = async (
  ctx: AIToolContext,
  resolution: CandidateIdentity,
  year: number,
  topN: number,
): Promise<LeadingMunicipalityRow[] | { error: string }> => {
  try {
    return await loadLeadingMunicipalitiesForCandidate(ctx.payload, ctx.user, {
      candidateNumber: resolution.candidateNumber,
      year,
      topN,
    })
  } catch {
    return { error: 'Não foi possível consultar as cidades líderes agora. Tente de novo.' }
  }
}
