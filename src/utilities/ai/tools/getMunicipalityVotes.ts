import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import {
  BASELINE_TICKET_2022,
  ELECTION_YEAR_2014,
  ELECTION_YEAR_2018,
  ELECTION_YEAR_2022,
  FEDERAL_DEPUTY_OFFICE,
} from '@/lib/electionResults'
import { municipalityCatalogEntriesForCity } from '@/lib/municipalityCatalog'
import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import { electionDataGate } from '@/utilities/ai/tools/electionDataGate'
import { municipalityElectionGeographyForSlug } from '@/utilities/municipality/municipalityElectionGeography'

const VOTE_YEARS = [ELECTION_YEAR_2014, ELECTION_YEAR_2018, ELECTION_YEAR_2022] as const

type VoteSeriesEntry = {
  year: number
  votes: number
  validVotes: number | null
}

export const getMunicipalityVotes = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns Jorge Solla vote totals and valid votes per year for a municipality. ' +
      'Use this when the user asks "Quantos votos tivemos em X?" or "Qual foi a votação em X?". ' +
      'Accepts a municipality name (e.g. "Feira de Santana") or slug (e.g. "feira-de-santana").',
    inputSchema: z.object({
      municipality: z.string().describe('Municipality name or slug.'),
    }),
    execute: async ({ municipality }) => {
      // Leader lockdown: municipal election conversations are staff-only.
      const gate = electionDataGate(ctx)
      if (gate !== true) return gate

      const { payload } = ctx

      // Resolve to catalog entry
      const canonical = resolveMunicipalityName(municipality) ?? municipality
      const entries = municipalityCatalogEntriesForCity(canonical)
      if (entries.length === 0) {
        // Try as a slug
        const geography = municipalityElectionGeographyForSlug(municipality)
        if (!geography) {
          return {
            error: `Município não encontrado: "${municipality}". Verifique o nome e tente novamente.`,
          }
        }
        return queryVotes(payload, geography, municipality)
      }

      // For whole municipalities (not Salvador), aggregate all zones
      const allZones = entries.flatMap((e) => [...e.tseZones])
      const cityCode = entries[0].tseCityCode
      return queryVotes(payload, { cityCode, zones: allZones }, canonical)
    },
  })

async function queryVotes(
  payload: AIToolContext['payload'],
  geography: { cityCode: string; zones: number[] },
  displayName: string,
) {
  const results: VoteSeriesEntry[] = []

  for (const year of VOTE_YEARS) {
    const [votesResult, tallyResult] = await Promise.all([
      payload.find({
        collection: 'electionCandidateVote',
        where: {
          and: [
            { year: { equals: year } },
            { office: { equals: FEDERAL_DEPUTY_OFFICE } },
            { turn: { equals: '1' } },
            { voteType: { equals: 'nominal' } },
            { candidateNumber: { equals: BASELINE_TICKET_2022.candidate.candidateNumber } },
            { cityCode: { equals: geography.cityCode } },
            { zoneNumber: { in: geography.zones } },
          ],
        },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { votes: true },
        // Bypass: public TSE vote rows; access gated by electionDataGate at the tool level.
        overrideAccess: true,
      }),
      payload.find({
        collection: 'electionTally',
        where: {
          and: [
            { year: { equals: year } },
            { office: { equals: FEDERAL_DEPUTY_OFFICE } },
            { turn: { equals: '1' } },
            { cityCode: { equals: geography.cityCode } },
            { zoneNumber: { in: geography.zones } },
          ],
        },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { votosValidos: true },
        // Bypass: public TSE tally rows; access gated by electionDataGate at the tool level.
        overrideAccess: true,
      }),
    ])

    const totalVotes = votesResult.docs.reduce((sum, row) => sum + (row.votes ?? 0), 0)
    const totalValid = tallyResult.docs.reduce((sum, row) => sum + (row.votosValidos ?? 0), 0)

    results.push({
      year,
      votes: totalVotes,
      validVotes: totalValid > 0 ? totalValid : null,
    })
  }

  return {
    municipality: displayName,
    candidate: `${BASELINE_TICKET_2022.candidate.name} (${BASELINE_TICKET_2022.candidate.party})`,
    series: results.map((r) => ({
      year: r.year,
      votes: r.votes,
      share: r.validVotes ? `${((r.votes / r.validVotes) * 100).toFixed(1)}%` : 'n/d',
    })),
    summary: results
      .filter((r) => r.votes > 0)
      .map((r) => `${r.year}: ${r.votes.toLocaleString('pt-BR')} votos`),
  }
}
