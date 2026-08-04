import { tool } from 'ai'
import { z } from 'zod'

import type { AIToolContext } from '@/lib/ai/types'
import { ELECTION_YEAR_2022, FEDERAL_DEPUTY_OFFICE } from '@/lib/electionResults'
import { municipalityCatalogEntriesForCity } from '@/lib/municipalityCatalog'
import { resolveMunicipalityName } from '@/lib/municipalityNameAliases'
import { municipalityElectionGeographyForSlug } from '@/utilities/municipality/municipalityElectionGeography'

type RankedDeputy = {
  rank: number
  candidateNumber: number
  name: string
  party: string | null
  votes: number
  share: string
}

export const getTopDeputies = (ctx: AIToolContext) =>
  tool({
    description:
      'Returns the most-voted federal deputy candidates in a municipality for a given year. ' +
      'Use when the user asks "Quem foi o deputado mais votado em X?" or ranking questions. ' +
      'Default year is 2022. Limit defaults to 5, max 20.',
    inputSchema: z.object({
      municipality: z.string().describe('Municipality name or slug.'),
      year: z
        .number()
        .optional()
        .default(ELECTION_YEAR_2022)
        .describe('Election year (2014, 2018, or 2022).'),
      limit: z.number().optional().default(5).describe('Number of deputies to return (max 20).'),
    }),
    execute: async ({ municipality, year, limit }) => {
      const { payload } = ctx
      const canonical = resolveMunicipalityName(municipality) ?? municipality
      const entries = municipalityCatalogEntriesForCity(canonical)
      const geography = entries.length
        ? { cityCode: entries[0].tseCityCode, zones: entries.flatMap((e) => [...e.tseZones]) }
        : municipalityElectionGeographyForSlug(municipality)

      if (!geography) {
        return {
          error: `Município não encontrado: "${municipality}". Verifique o nome e tente novamente.`,
        }
      }

      const safeLimit = Math.min(limit, 20)

      const result = await payload.find({
        collection: 'electionCandidateVote',
        where: {
          and: [
            { year: { equals: year } },
            { office: { equals: FEDERAL_DEPUTY_OFFICE } },
            { turn: { equals: '1' } },
            { voteType: { equals: 'nominal' } },
            { cityCode: { equals: geography.cityCode } },
            { zoneNumber: { in: geography.zones } },
          ],
        },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { candidateNumber: true, candidateName: true, party: true, votes: true },
        // Bypass: election data is public TSE results; access gated by
        // the collection-level canReadElectionData guard.
        overrideAccess: true,
        sort: '-votes',
      })

      // Aggregate by candidate number across zones
      const byCandidate = new Map<number, { name: string; party: string | null; votes: number }>()
      for (const row of result.docs) {
        const existing = byCandidate.get(row.candidateNumber)
        if (existing) {
          existing.votes += row.votes ?? 0
        } else {
          byCandidate.set(row.candidateNumber, {
            name: row.candidateName ?? `Candidato ${row.candidateNumber}`,
            party: row.party ?? null,
            votes: row.votes ?? 0,
          })
        }
      }

      const totalVotes = [...byCandidate.values()].reduce((s, c) => s + c.votes, 0)

      // Sort by votes descending and take top N
      const ranked: RankedDeputy[] = [...byCandidate.entries()]
        .sort(([, a], [, b]) => b.votes - a.votes)
        .slice(0, safeLimit)
        .map(([number, candidate], index) => ({
          rank: index + 1,
          candidateNumber: number,
          name: candidate.name,
          party: candidate.party,
          votes: candidate.votes,
          share: totalVotes > 0 ? `${((candidate.votes / totalVotes) * 100).toFixed(1)}%` : 'n/d',
        }))

      return {
        municipality: canonical,
        year,
        totalNominalVotes: totalVotes,
        topDeputies: ranked,
      }
    },
  })
