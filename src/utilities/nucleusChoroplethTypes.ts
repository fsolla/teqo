import type { NucleusElectionGeographyInput } from '@/utilities/nucleusElectoralBaseline'

export type ChoroplethMetric = 'nucleusCount' | 'confirmedEstimate' | 'baseline2022Votes'

export type ChoroplethValues = Record<string, number>

export type NucleusChoroplethNucleus = NucleusElectionGeographyInput & {
  confirmedVoteEstimate: number | null
}

export type NucleusChoroplethBundle = {
  municipality: Record<ChoroplethMetric, ChoroplethValues>
  territory: Record<ChoroplethMetric, ChoroplethValues>
}

export const choroplethMetricLabels: Record<ChoroplethMetric, string> = {
  nucleusCount: 'Núcleos',
  confirmedEstimate: 'Estimativa confirmada',
  baseline2022Votes: 'Votos Solla 2022',
}

export const emptyNucleusChoroplethBundle = (): NucleusChoroplethBundle => ({
  municipality: {
    nucleusCount: {},
    confirmedEstimate: {},
    baseline2022Votes: {},
  },
  territory: {
    nucleusCount: {},
    confirmedEstimate: {},
    baseline2022Votes: {},
  },
})
