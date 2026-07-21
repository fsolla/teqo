import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { BASELINE_TICKET_2022, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import { assertCanReadElectionData, type ElectionDataReader } from '@/utilities/campaignAccess'
import { drizzleResultRows, requirePostgresDrizzle } from '@/utilities/drizzleBulk'
import { type PlazaElectionGeography, zonesByCityCode } from '@/utilities/plazaElectionGeography'

export type FederalCandidateTotal = {
  candidateNumber: number
  name: string
  party: string
  votes: number
}

export const loadFederalCandidateTotalsAggregated = async (
  payload: Pick<Payload, 'db'>,
  user: ElectionDataReader,
  geography: PlazaElectionGeography,
): Promise<FederalCandidateTotal[]> => {
  assertCanReadElectionData(user)

  const cityClauses = [...zonesByCityCode(geography).entries()].map(
    ([cityCode, zones]) =>
      sql`("election_candidate_vote"."city_code" = ${cityCode} AND "election_candidate_vote"."zone_number" IN (${sql.join(
        zones.map((zone) => sql`${zone}`),
        sql`, `,
      )}))`,
  )

  const drizzle = requirePostgresDrizzle(payload, 'agregação federal')
  const result = await drizzle.execute(sql`
    SELECT
      "election_candidate_vote"."candidate_number" AS "candidate_number",
      MAX("election_candidate_vote"."candidate_name") AS "candidate_name",
      COALESCE(MAX("election_candidate_vote"."party"), '') AS "party",
      SUM("election_candidate_vote"."votes")::int AS "votes"
    FROM "election_candidate_vote"
    WHERE
      "election_candidate_vote"."year" = ${ELECTION_YEAR_2022}
      AND "election_candidate_vote"."state" = 'BA'
      AND "election_candidate_vote"."office" = ${BASELINE_TICKET_2022.candidate.office}
      AND "election_candidate_vote"."turn" = '1'
      AND "election_candidate_vote"."vote_type" = 'nominal'
      AND (${sql.join(cityClauses, sql` OR `)})
    GROUP BY "election_candidate_vote"."candidate_number"
    ORDER BY "votes" DESC, "election_candidate_vote"."candidate_number" ASC
  `)

  return drizzleResultRows(result).map((row) => ({
    candidateNumber: Number(row.candidate_number),
    name: String(row.candidate_name ?? ''),
    party: String(row.party),
    votes: Number(row.votes ?? 0),
  }))
}
